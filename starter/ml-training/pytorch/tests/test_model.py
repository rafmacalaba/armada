"""Tests for src/model.py."""

import torch

from src.model import SimpleModel


def test_simple_model_forward_shape():
    model = SimpleModel(input_dim=10, output_dim=1)
    x = torch.randn(2, 10)
    out = model(x)
    assert out.shape == (2, 1)
