# Broken Telephone protocol v1 (Keystone packer)

Keystone emits this markdown block as the first message for the next model.

Required ideas:

- `goal` — the user's actual goal
- `current_state` — what is true now
- `done` — finished work only
- `next action` — one concrete step
- `constraints` — rules that would hurt to break
- `what not to do` — restarts the last model already paid for

The v0.1 packer is local and heuristic. It does not call a model. Prefer the user's own lines over inferred summaries. Cap the packet near 8,000 characters.
