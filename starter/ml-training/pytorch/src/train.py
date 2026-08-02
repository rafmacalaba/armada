"""Train a model on {project_name} data."""
import torch
import torch.nn as nn
import torch.optim as optim


def main():
    print("Training {project_name}...")
    model = nn.Linear(10, 1)
    optimizer = optim.SGD(model.parameters(), lr=0.01)
    loss_fn = nn.MSELoss()

    x = torch.randn(100, 10)
    y = torch.randn(100, 1)

    for epoch in range(10):
        optimizer.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        optimizer.step()
        print(f"Epoch {epoch + 1}, Loss: {loss.item():.4f}")

    print("Done.")


if __name__ == "__main__":
    main()
