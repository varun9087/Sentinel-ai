from setuptools import find_packages, setup

setup(
    name="sentinel-ai",
    version="1.0.0",
    description="Python client SDK for Sentinel AI LLM Observability & Evaluation Platform",
    author="Sentinel AI Team",
    packages=find_packages(),
    install_requires=[
        "httpx>=0.24.0",
    ],
    python_requires=">=3.8",
)
