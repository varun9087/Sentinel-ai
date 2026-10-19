# Sentinel AI Evaluation Methodology & Metric Limitations

Sentinel AI provides real, reproducible evaluation metrics for LLM applications and RAG systems. This document details the mathematical formulation, algorithmic implementation, and inherent limitations of each metric.

---

## 1. Quality & Lexical Metrics

### A. Exact Match (EM)
* **Formulation**:
  $$\text{EM} = \begin{cases} 1.0 & \text{if } \text{normalize}(y_{\text{pred}}) = \text{normalize}(y_{\text{gold}}) \\ 0.0 & \text{otherwise} \end{cases}$$
* **Normalization**: Trims whitespace, strips leading/trailing punctuation, and converts characters to lowercase.
* **Limitations**: Highly strict. While effective for code generation, entity extraction, and classification, Exact Match will mark semantically identical paraphrases (e.g. "within 30 days" vs "within thirty days") as complete failures (0.0).

### B. Token-Level Precision, Recall, and F1
* **Formulation**:
  Given multiset token representations $T_{\text{pred}}$ and $T_{\text{gold}}$:
  $$\text{Overlap} = \sum_{t \in T_{\text{pred}} \cap T_{\text{gold}}} \min(\text{count}_{\text{pred}}(t), \text{count}_{\text{gold}}(t))$$
  $$\text{Precision} = \frac{\text{Overlap}}{|T_{\text{pred}}|}, \quad \text{Recall} = \frac{\text{Overlap}}{|T_{\text{gold}}|}$$
  $$F_1 = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$
* **Limitations**: Operates on lexical surface tokens. Does not account for semantic synonyms or contextual antonyms (e.g., "The plan is active" vs "The plan is not active" may share substantial token overlap despite opposite meanings).

---

## 2. RAG & Groundedness Metrics

### A. Faithfulness / Groundedness
* **Formulation**:
  Measures the degree to which factual statements in the generated response are grounded in the retrieved context:
  $$\text{Faithfulness} = \frac{|\text{InformativeTokens}(y_{\text{pred}}) \cap \text{Tokens}(C)|}{|\text{InformativeTokens}(y_{\text{pred}})|}$$
* **Methodology**: Informative tokens exclude common English stop words and punctuation.
* **Limitations**: Lexical heuristic approximation in local mode. If an answer introduces valid external knowledge not explicitly contained in the provided context, the score decreases.

### B. Answer Relevance
* **Formulation**:
  Measures how directly the generated answer addresses the prompt query:
  $$\text{Relevance} = 0.7 \cdot \text{KeywordCoverage}(q, y_{\text{pred}}) + 0.3 \cdot \min(1.0, \frac{|T_{\text{pred}}|}{5})$$
* **Methodology**: Evaluates essential query keyword presence and penalizes degenerate or empty responses.

### C. Context Recall & Context Precision
* **Context Recall**: Measures whether the ground-truth answer $y_{\text{gold}}$ could have been derived from the retrieved chunks:
  $$\text{Context Recall} = \frac{|\text{Tokens}(y_{\text{gold}}) \cap \text{Tokens}(C)|}{|\text{Tokens}(y_{\text{gold}})|}$$
* **Context Precision**: Signal-to-noise ratio in retrieved context relative to the input query.

---

## 3. Operational & Financial Metrics

### A. Latency Tracking
* Measured via high-resolution monotonic timers (`time.perf_counter()`) encompassing network transmission and inference completion.

### B. Cost Estimation vs Provider Invoicing
* **Estimated Cost**: Calculated deterministically using published token rates for input and output prompt tokens per model.
* **Provider Reported Cost**: May vary based on enterprise discounts, fine-tuning hosting fees, or batch discounts. Sentinel AI explicitly labels calculated costs as **Estimated**.

---

## 4. Evaluator Modes

1. **Deterministic Local Mode (Default)**: Guaranteed to execute locally with zero external network calls, zero paid API keys, and deterministic reproducibility.
2. **Model-as-a-Judge Mode (Configurable)**: When `OPENAI_API_KEY` is provided, prompt-based LLM evaluations can be performed. The system stores the judge model identifier, configuration, and raw output for full auditability.
