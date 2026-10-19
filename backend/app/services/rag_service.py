import math
import re
from collections import Counter
from typing import List, Tuple
import numpy as np
from backend.app.services.eval_service import (
    calculate_answer_relevance,
    calculate_faithfulness,
    generate_model_output,
    tokenize,
)


def chunk_text(text: str, chunk_size: int = 300, chunk_overlap: int = 50) -> List[str]:
    """
    Split text into overlapping chunks using word boundary preservation.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    start = 0
    step = max(1, chunk_size - chunk_overlap)

    while start < len(words):
        chunk_words = words[start : start + chunk_size]
        chunks.append(" ".join(chunk_words))
        if start + chunk_size >= len(words):
            break
        start += step

    return chunks


class DeterministicTfidfRetriever:
    """
    Deterministic TF-IDF Vector Retriever.
    Provides local vector retrieval without external API requirements or heavyweight C extensions.
    Accurately computes Term Frequency - Inverse Document Frequency and Cosine Similarity.
    """

    def __init__(self, corpus: List[str]):
        self.corpus = corpus
        self.num_docs = len(corpus)
        self.vocab = {}
        self.idf = {}
        self.doc_vectors = []
        self._build_index()

    def _build_index(self):
        doc_token_counts = []
        doc_freq = Counter()

        for doc in self.corpus:
            tokens = tokenize(doc)
            counts = Counter(tokens)
            doc_token_counts.append(counts)
            for token in counts.keys():
                doc_freq[token] += 1

        # Build vocabulary
        self.vocab = {term: idx for idx, term in enumerate(doc_freq.keys())}
        vocab_size = len(self.vocab)

        # Compute IDF: log((N + 1) / (df + 1)) + 1
        for term, df in doc_freq.items():
            self.idf[term] = math.log((self.num_docs + 1) / (df + 1)) + 1.0

        # Build TF-IDF vectors
        for counts in doc_token_counts:
            vec = np.zeros(vocab_size, dtype=np.float32)
            total_tokens = sum(counts.values()) or 1
            for term, count in counts.items():
                if term in self.vocab:
                    idx = self.vocab[term]
                    tf = count / total_tokens
                    vec[idx] = tf * self.idf[term]
            
            # L2 normalize
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            self.doc_vectors.append(vec)

    def query(self, query_text: str, top_k: int = 3) -> List[Tuple[int, float]]:
        """
        Query the index and return list of (doc_index, cosine_similarity_score).
        """
        if not self.corpus or not self.vocab:
            return []

        tokens = tokenize(query_text)
        query_counts = Counter(tokens)
        query_vec = np.zeros(len(self.vocab), dtype=np.float32)
        total_tokens = sum(query_counts.values()) or 1

        for term, count in query_counts.items():
            if term in self.vocab:
                idx = self.vocab[term]
                tf = count / total_tokens
                query_vec[idx] = tf * self.idf.get(term, 1.0)

        q_norm = np.linalg.norm(query_vec)
        if q_norm > 0:
            query_vec = query_vec / q_norm
        else:
            # Query has zero matching vocabulary
            return [(i, 0.0) for i in range(min(top_k, len(self.corpus)))]

        scores = []
        for idx, doc_vec in enumerate(self.doc_vectors):
            similarity = float(np.dot(query_vec, doc_vec))
            scores.append((idx, round(similarity, 4)))

        # Sort descending by score
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]
