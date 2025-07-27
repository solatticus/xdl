# Code Style Guidelines for Claude

## C# / .NET Specific

### Null Checking
- After a successful regex match, the captured groups will have values - don't use `string.IsNullOrEmpty()` on them
- Use pattern matching where appropriate: `if (obj is null)` instead of `if (obj == null)`
- Don't check for both null and empty when only one is possible

### Async/Await
- Never use `async` without corresponding `await` operations
- If a method doesn't need to be async, return `Task.FromResult()` instead
- Don't make methods async just to return a completed task

### General Patterns
- Think about whether validation is actually needed - don't add redundant checks
- If a regex match fails, you already know the result - don't double-check
- Use the most specific check needed, not a broader one

## Example of What NOT to Do
```csharp
// BAD - Redundant check
var match = Regex.Match(input, @"(\d+)");
if (!match.Success) return;
var value = match.Groups[1].Value;
if (string.IsNullOrEmpty(value)) // <-- This is redundant!
    return;

// GOOD
var match = Regex.Match(input, @"(\d+)");
if (!match.Success) return;
var value = match.Groups[1].Value; // Will have a value if match succeeded
```

## Project-Specific Notes
- This is a video downloader for personal use
- Prefer simple, direct code over over-engineered solutions
- No unnecessary abstractions or interfaces for simple utilities