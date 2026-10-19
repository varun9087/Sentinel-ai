from typing import Dict, Tuple

# Pricing table per 1,000,000 tokens (input_usd, output_usd)
MODEL_PRICING: Dict[str, Tuple[float, float]] = {
    # OpenAI
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4-turbo": (10.00, 30.00),
    "gpt-3.5-turbo": (0.50, 1.50),
    # Anthropic
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3-opus": (15.00, 75.00),
    # Open / Meta / Local
    "llama-3.1-70b": (0.90, 0.90),
    "llama-3.1-8b": (0.18, 0.18),
    "mistral-large": (2.00, 6.00),
    # Default fallback
    "local-evaluator": (0.00, 0.00),
    "local-generator": (0.00, 0.00),
    "mock-v2": (0.00, 0.00),
    "custom": (1.00, 2.00),
}


def estimate_token_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """
    Compute estimated cost in USD based on published token pricing models.
    Distinguishes estimated cost from provider-reported billed cost.
    """
    model_key = model.lower()
    pricing = None
    for name, rates in MODEL_PRICING.items():
        if name in model_key:
            pricing = rates
            break
            
    if not pricing:
        pricing = MODEL_PRICING["custom"]

    input_rate_per_m, output_rate_per_m = pricing
    cost = (input_tokens * input_rate_per_m / 1_000_000.0) + (output_tokens * output_rate_per_m / 1_000_000.0)
    return round(cost, 6)
