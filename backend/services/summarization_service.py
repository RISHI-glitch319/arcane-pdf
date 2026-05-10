"""
High-Performance Summarization Service for Digital Sovereignty PDF Cloning Engine
Provides hybrid summarization with structure-aware processing and parallel execution
"""

import logging
import math
import os
import re
import tempfile
import threading
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass
import importlib
import torch
try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
except ImportError:
    AutoTokenizer = None
    AutoModelForSeq2SeqLM = None

logger = logging.getLogger(__name__)

@dataclass
class SummaryConfig:
    """Configuration for summarization"""
    summary_ratio: float = 0.2
    mode: str = "summary"  # "summary", "bullet_points", "technical"
    preserve_structure: bool = True
    use_abstractive: bool = False
    max_chunk_tokens: int = 1500

@dataclass
class SummaryResult:
    """Result of summarization"""
    summary: str
    sections: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    config: SummaryConfig

class SummarizationService:
    """High-performance summarization with hybrid processing"""
    
    def __init__(self, model_cache_dir: str = None):
        self.model_cache_dir = model_cache_dir or os.path.join(tempfile.gettempdir(), "models")
        if self.model_cache_dir:
            try:
                os.makedirs(self.model_cache_dir, exist_ok=True)
            except OSError as exc:
                logger.warning(f"Model cache directory unavailable: {exc}")
                self.model_cache_dir = None
        self._model_cache = {}
        self._model_lock = threading.Lock()
        
    def summarize(self, text: str, structure: List[Dict[str, Any]] = None, 
                 progress_callback: Optional[Callable] = None, **params) -> Dict[str, Any]:
        """
        Summarize text with hybrid processing
        """
        try:
            # Create configuration
            config = SummaryConfig(
                summary_ratio=params.get('summary_ratio', 0.2),
                mode=params.get('mode', 'summary'),
                preserve_structure=params.get('preserve_structure', True),
                use_abstractive=params.get('use_abstractive', False),
                max_chunk_tokens=params.get('max_chunk_tokens', 1500)
            )
            
            # Validate parameters
            if not 0.1 <= config.summary_ratio <= 0.5:
                raise ValueError("summary_ratio must be between 0.1 and 0.5")
            if config.mode not in ["summary", "bullet_points", "technical"]:
                raise ValueError("mode must be 'summary', 'bullet_points', or 'technical'")
            
            # Semantic chunking
            if progress_callback:
                progress_callback(10)
            
            chunks = self._semantic_chunk(text, structure, config)
            if not chunks:
                raise ValueError("Failed to chunk text for summarization")
            
            if progress_callback:
                progress_callback(20)
            
            # Hierarchical summarization
            result = self._hierarchical_summarize(chunks, config, progress_callback)
            
            if progress_callback:
                progress_callback(90)
            
            # Format output based on mode
            if config.mode == "bullet_points":
                result.summary = self._format_as_bullet_points(result.summary)
            elif config.mode == "technical":
                result.summary = self._format_technical_summary(result.summary)
            
            if progress_callback:
                progress_callback(100)
            
            return self._format_result(result)
            
        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            return {
                "status": "error",
                "tool": "summarization",
                "message": str(e),
                "data": None
            }
    
    def _semantic_chunk(self, text: str, structure: List[Dict[str, Any]], config: SummaryConfig) -> List[Dict[str, Any]]:
        """Chunk text semantically based on structure"""
        chunks = []
        current_chunk = {
            "elements": [],
            "text": "",
            "token_count": 0
        }
        
        # Use structure if available, otherwise split text
        if structure:
            elements = structure
        else:
            # Create simple paragraph structure
            paragraphs = text.split('\n\n')
            elements = [{"type": "paragraph", "text": p.strip()} for p in paragraphs if p.strip()]
        
        for element in elements:
            element_text = element["text"]
            # Rough token estimation (1 token ≈ 4 characters)
            element_tokens = len(element_text) // 4
            
            # Check if adding this element would exceed chunk size
            if current_chunk["token_count"] + element_tokens > config.max_chunk_tokens and current_chunk["elements"]:
                # Save current chunk and start new one
                chunks.append(current_chunk)
                current_chunk = {
                    "elements": [],
                    "text": "",
                    "token_count": 0
                }
            
            # Add element to current chunk
            current_chunk["elements"].append(element)
            current_chunk["text"] += element_text + "\n"
            current_chunk["token_count"] += element_tokens
        
        # Add final chunk if it has content
        if current_chunk["elements"]:
            chunks.append(current_chunk)
        
        return chunks
    
    def _hierarchical_summarize(self, chunks: List[Dict[str, Any]], config: SummaryConfig, 
                              progress_callback: Optional[Callable] = None) -> SummaryResult:
        """Hierarchical summarization with progress tracking"""
        chunk_summaries = []
        sections = []
        total_chunks = len(chunks)
        
        # Summarize each chunk individually
        for i, chunk in enumerate(chunks):
            # Update progress (20-80% for chunk processing)
            if progress_callback:
                progress = 20 + int((i / total_chunks) * 60)
                progress_callback(progress)
            
            chunk_summary = self._hybrid_summarize_chunk(chunk["text"], config)
            chunk_summaries.append(chunk_summary)
            
            # Extract section title if structure is preserved
            if config.preserve_structure and chunk["elements"]:
                heading_element = next(
                    (el for el in chunk["elements"] if el["type"] == "heading"),
                    None
                )
                if heading_element:
                    sections.append({
                        "title": heading_element["text"],
                        "summary": chunk_summary
                    })
        
        # Merge chunk summaries
        merged_summary = "\n\n".join(chunk_summaries)
        
        # Final refinement pass
        if len(merged_summary) > 500:
            final_summary = self._hybrid_summarize_chunk(merged_summary, config)
        else:
            final_summary = merged_summary
        
        return SummaryResult(
            summary=final_summary,
            sections=sections,
            metadata={
                "chunks_processed": len(chunks),
                "compression_ratio": len("\n".join(chunk["text"] for chunk in chunks)) / max(len(final_summary), 1),
                "total_elements": sum(len(chunk["elements"]) for chunk in chunks)
            },
            config=config
        )
    
    def _hybrid_summarize_chunk(self, text: str, config: SummaryConfig) -> str:
        """Hybrid summarization for a single chunk"""
        if not text.strip():
            return ""
        
        # Stage 1: Extractive summarization
        try:
            extractive_summary = self._extractive_summarize(text, config.summary_ratio)
            if not extractive_summary or extractive_summary == text[:500] + "...":
                extractive_summary = text
        except Exception as e:
            logger.error(f"Extractive summarization failed: {e}")
            extractive_summary = text
        
        # Stage 2: Optional abstractive summarization
        if config.use_abstractive and len(extractive_summary) > 100:
            try:
                abstractive_summary = self._abstractive_summarize(extractive_summary)
                if abstractive_summary.strip():
                    return abstractive_summary.strip()
            except Exception as e:
                logger.error(f"Abstractive summarization failed: {e}")
                # Fall back to extractive
                pass
        
        return extractive_summary
    
    def _extractive_summarize(self, text: str, ratio: float) -> str:
        """Extractive summarization using TextRank"""
        try:
            # Import sumy components
            plaintext = importlib.import_module("sumy.parsers.plaintext")
            tokenizer_mod = importlib.import_module("sumy.nlp.tokenizers")
            summarizer_mod = importlib.import_module("sumy.summarizers.text_rank")
            
            parser = plaintext.PlaintextParser.from_string(text, tokenizer_mod.Tokenizer("english"))
            summarizer = summarizer_mod.TextRankSummarizer()
            
            # Calculate target based on sentence count
            sentence_count = len(parser.document.sentences)
            target = max(3, math.ceil(sentence_count * ratio))
            
            summary_sentences = summarizer(parser.document, target)
            
            # Format into paragraphs
            paragraphs, current_p = [], []
            for i, sent in enumerate(summary_sentences):
                current_p.append(str(sent))
                if (i + 1) % 4 == 0:
                    paragraphs.append(" ".join(current_p))
                    current_p = []
            
            if current_p:
                paragraphs.append(" ".join(current_p))
                
            return "\n\n".join(paragraphs)
            
        except Exception as e:
            logger.error(f"Extractive summarization failed: {e}")
            return text[:500] + "..."
    
    def _abstractive_summarize(self, text: str, model_name: str = "t5-small") -> str:
        """Abstractive summarization using transformer models"""
        try:
            model, tokenizer = self._load_abstractive_model(model_name)
            if not model or not tokenizer:
                return text
            
            # Prepare input for T5
            if "summarize" not in text.lower():
                input_text = f"summarize: {text}"
            else:
                input_text = text
            
            # Tokenize and generate
            inputs = tokenizer(
                input_text,
                return_tensors="pt",
                max_length=512,
                truncation=True,
                padding=True
            )
            
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_length=min(256, len(text) // 4),
                    num_beams=3,
                    early_stopping=True,
                    temperature=0.7,
                    length_penalty=1.0
                )
            
            summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
            return summary.strip() if summary.strip() else text
            
        except Exception as e:
            logger.error(f"Abstractive summarization failed: {e}")
            return text
    
    def _load_abstractive_model(self, model_name: str) -> Tuple[Any, Any]:
        """Load abstractive model with caching"""
        if model_name in self._model_cache:
            return self._model_cache[model_name]
        
        with self._model_lock:
            if model_name in self._model_cache:
                return self._model_cache[model_name]
            
            try:
                if AutoTokenizer is None or AutoModelForSeq2SeqLM is None:
                    logger.warning("Transformers dependency unavailable; using extractive summarization.")
                    self._model_cache[model_name] = (None, None)
                    return None, None

                logger.info(f"Loading abstractive model: {model_name}")
                tokenizer = AutoTokenizer.from_pretrained(
                    model_name,
                    cache_dir=self.model_cache_dir,
                    local_files_only=False
                )
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_name,
                    cache_dir=self.model_cache_dir,
                    local_files_only=False
                )
                model.eval()
                
                self._model_cache[model_name] = (model, tokenizer)
                logger.info(f"Successfully loaded {model_name}")
                return model, tokenizer
                
            except Exception as e:
                logger.error(f"Failed to load abstractive model {model_name}: {e}")
                return None, None
    
    def _format_as_bullet_points(self, text: str) -> str:
        """Convert summary to bullet point format"""
        sentences = re.split(r'[.!?]+', text)
        bullet_points = []
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 10:
                bullet_points.append(f"• {sentence.capitalize()}")
        
        return "\n".join(bullet_points)
    
    def _format_technical_summary(self, text: str) -> str:
        """Format summary for technical audiences"""
        sentences = re.split(r'[.!?]+', text)
        technical_sentences = []
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 10:
                # Preserve technical terms and add emphasis
                if any(keyword in sentence.lower() for keyword in ['method', 'algorithm', 'system', 'process', 'result']):
                    technical_sentences.append(f"KEY: {sentence}")
                else:
                    technical_sentences.append(sentence)
        
        return ". ".join(technical_sentences) + "."
    
    def _format_result(self, result: SummaryResult) -> Dict[str, Any]:
        """Format summarization result for API response"""
        return {
            "status": "success",
            "tool": "summarization",
            "data": {
                "summary": result.summary,
                "sections": result.sections,
                "metadata": {
                    **result.metadata,
                    "config": {
                        "summary_ratio": result.config.summary_ratio,
                        "mode": result.config.mode,
                        "preserve_structure": result.config.preserve_structure,
                        "use_abstractive": result.config.use_abstractive
                    }
                }
            },
            "error": None
        }

# Global summarization service instance
summarization_service = SummarizationService()
