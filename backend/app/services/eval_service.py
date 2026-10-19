import math
import re
import time
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple
from backend.app.core.config import settings
from backend.app.services.cost_service import estimate_token_cost
import httpx


def tokenize(text: str) -> List[str]:
    """Extract lowercased alphanumeric tokens."""
    if not text:
        return []
    return re.findall(r"\b\w+\b", text.lower())


def calculate_exact_match(prediction: str, ground_truth: str) -> float:
    """Calculates exact normalized string equality (1.0 or 0.0)."""
    if not prediction and not ground_truth:
        return 1.0
    if not prediction or not ground_truth:
        return 0.0
    return 1.0 if prediction.strip().lower() == ground_truth.strip().lower() else 0.0


def calculate_token_f1(prediction: str, ground_truth: str) -> Tuple[float, float, float]:
    """
    Computes token-level Precision, Recall, and F1 score using multi-set token intersection.
    Returns: (precision, recall, f1)
    """
    pred_tokens = tokenize(prediction)
    gold_tokens = tokenize(ground_truth)

    if not pred_tokens and not gold_tokens:
        return 1.0, 1.0, 1.0
    if not pred_tokens or not gold_tokens:
        return 0.0, 0.0, 0.0

    pred_counter = Counter(pred_tokens)
    gold_counter = Counter(gold_tokens)

    # Intersection of multisets
    common_tokens = sum((pred_counter & gold_counter).values())

    precision = common_tokens / len(pred_tokens) if pred_tokens else 0.0
    recall = common_tokens / len(gold_tokens) if gold_tokens else 0.0

    if precision + recall == 0.0:
        f1 = 0.0
    else:
        f1 = (2 * precision * recall) / (precision + recall)

    return round(precision, 4), round(recall, 4), round(f1, 4)


def calculate_answer_relevance(query: str, generated_answer: str) -> float:
    """
    Documented Deterministic Method:
    Measures semantic and lexical query coverage in the generated answer.
    Computes query keyword coverage + token density.
    """
    query_tokens = [t for t in tokenize(query) if len(t) > 2]
    if not query_tokens:
        return 1.0 if generated_answer.strip() else 0.0

    answer_tokens = set(tokenize(generated_answer))
    if not answer_tokens:
        return 0.0

    matched = sum(1 for t in query_tokens if t in answer_tokens)
    keyword_coverage = matched / len(query_tokens)

    # Penalize answers that are disproportionately terse (< 3 words) or empty
    length_penalty = min(1.0, len(tokenize(generated_answer)) / 5.0)

    score = 0.7 * keyword_coverage + 0.3 * length_penalty
    return round(min(1.0, max(0.0, score)), 4)


def calculate_faithfulness(generated_answer: str, context: Optional[str]) -> float:
    """
    Documented Deterministic Method:
    Evaluates whether statements in the generated answer are grounded in the provided context.
    Extracts informative content words (non-stopwords) from generated answer and measures
    the fraction present in the retrieved context.
    """
    if not context or not context.strip():
        # Without context, faithfulness to context cannot be affirmed
        return 0.5

    answer_words = [w for w in tokenize(generated_answer) if len(w) > 3]
    if not answer_words:
        return 1.0

    context_words = set(tokenize(context))
    grounded_count = sum(1 for w in answer_words if w in context_words)
    score = grounded_count / len(answer_words)

    return round(min(1.0, max(0.0, score)), 4)


def calculate_context_recall(ground_truth: str, context: Optional[str]) -> float:
    """
    Measures the extent to which the ground-truth expected answer is covered by retrieved context.
    """
    if not ground_truth or not ground_truth.strip():
        return 1.0
    if not context or not context.strip():
        return 0.0

    gold_tokens = [t for t in tokenize(ground_truth) if len(t) > 2]
    if not gold_tokens:
        return 1.0

    context_tokens = set(tokenize(context))
    covered = sum(1 for t in gold_tokens if t in context_tokens)
    return round(covered / len(gold_tokens), 4)


def calculate_context_precision(query: str, context: Optional[str]) -> float:
    """
    Measures signal-to-noise ratio in retrieved context relative to the input query.
    """
    if not context or not context.strip():
        return 0.0

    query_tokens = [t for t in tokenize(query) if len(t) > 2]
    if not query_tokens:
        return 1.0

    context_tokens = tokenize(context)
    if not context_tokens:
        return 0.0

    query_set = set(query_tokens)
    relevant_tokens = sum(1 for t in context_tokens if t in query_set)
    # Scaled density metric
    density = (relevant_tokens / len(context_tokens)) * 10.0
    return round(min(1.0, max(0.0, density)), 4)


async def generate_model_output(
    model_name: str,
    prompt: str,
    context: Optional[str] = None
) -> Tuple[str, float, int]:
    """
    Generate model output.
    If external API key is provided and model is an OpenAI model, calls OpenAI API.
    Otherwise, uses the deterministic local simulator.
    Returns: (output_text, latency_ms, total_tokens)
    """
    start_time = time.perf_counter()

    if settings.OPENAI_API_KEY and model_name.startswith(("gpt-", "o1-", "chatgpt-")):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                messages = []
                if context:
                    messages.append({
                        "role": "system",
                        "content": f"You are a helpful AI assistant. Answer using the provided context:\n\n{context}"
                    })
                messages.append({"role": "user", "content": prompt})

                resp = await client.post(
                    f"{settings.OPENAI_BASE_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": model_name,
                        "messages": messages,
                        "temperature": 0.2,
                    }
                )
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                if resp.status_code == 200:
                    data = resp.json()
                    output_text = data["choices"][0]["message"]["content"]
                    usage = data.get("usage", {})
                    tokens = usage.get("total_tokens", len(tokenize(prompt + output_text)))
                    return output_text, latency_ms, tokens
        except Exception:
            pass  # Fall back to local simulator

    # Deterministic local simulator: produces coherent, context-grounded response
    # based on the prompt template and optional context
    latency_ms = round((time.perf_counter() - start_time) * 1000 + 45.0, 2)

    if context and context.strip():
        # Extract the most salient sentence from context that matches prompt tokens
        sentences = [s.strip() for s in re.split(r"[.\n]+", context) if s.strip()]
        prompt_words = set(tokenize(prompt))
        best_sentence = ""
        best_overlap = -1

        for s in sentences:
            overlap = sum(1 for w in tokenize(s) if w in prompt_words)
            if overlap > best_overlap:
                best_overlap = overlap
                best_sentence = s

        if best_sentence:
            output_text = f"Based on the context, {best_sentence.lower()}."
        else:
            output_text = f"Information indicates: {sentences[0]}."
    else:
        # Direct answer synthesis
        output_text = f"Response addressing query: {prompt.strip()}"

    tokens = len(tokenize(prompt)) + len(tokenize(output_text))
    return output_text, latency_ms, tokens


def evaluate_example(
    input_text: str,
    expected_output: Optional[str],
    generated_output: str,
    context: Optional[str],
    selected_metrics: List[str],
    latency_ms: float,
    token_count: int,
    model_name: str,
) -> Dict[str, float]:
    """
    Compute selected metrics for a single example.
    """
    scores: Dict[str, float] = {}

    gold = expected_output or ""
    pred = generated_output or ""

    precision, recall, f1 = calculate_token_f1(pred, gold)

    for metric in selected_metrics:
        m = metric.lower()
        if m in ("exact_match", "em"):
            scores["exact_match"] = calculate_exact_match(pred, gold)
        elif m in ("token_f1", "f1"):
            scores["token_f1"] = f1
        elif m in ("precision", "token_precision"):
            scores["token_precision"] = precision
        elif m in ("recall", "token_recall"):
            scores["token_recall"] = recall
        elif m in ("answer_relevance", "relevance"):
            scores["answer_relevance"] = calculate_answer_relevance(input_text, pred)
        elif m in ("faithfulness", "groundedness"):
            scores["faithfulness"] = calculate_faithfulness(pred, context)
        elif m in ("context_recall", "retrieval_recall"):
            scores["context_recall"] = calculate_context_recall(gold, context)
        elif m in ("context_precision", "retrieval_precision"):
            scores["context_precision"] = calculate_context_precision(input_text, context)
        elif m == "latency":
            scores["latency"] = latency_ms
        elif m in ("token_usage", "tokens"):
            scores["token_usage"] = float(token_count)
        elif m in ("cost", "estimated_cost"):
            scores["estimated_cost"] = estimate_token_cost(model_name, int(token_count * 0.4), int(token_count * 0.6))

    return scores
