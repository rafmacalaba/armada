"""Model definition for {project_name}."""
import torch.nn as nn


class SimpleModel(nn.Module):
    def __init__(self, input_dim: int = 10, output_dim: int = 1):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, output_dim),
        )

    def forward(self, x):
        return self.fc(x)
