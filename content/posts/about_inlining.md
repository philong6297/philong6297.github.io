+++
author = "longlp"
title = "About inlining"
date = "2021-11-20"
tags = [
    "cpp",
]
+++

## Introduction

For me, every time I encounter the `inline` keyword in codebase and document myself about it, I still end up with the same conclusions:

> Inlining is often misused in development, which results in counter-productive and risky situations.

I will try to summarize all the aspects which I believe we need to remember about inlining, giving pros, cons and situations when it can be used and when we should avoid.

## Definition

From the C++ standard definition of `inline`:

> The original intent of the `inline` keyword was to serve as an indicator to the optimizer that [inline substitution of a function][2] is preferred over function call, that is, instead of executing the function call CPU instruction to transfer control to the function body, a copy of the function body is executed without generating the call. This avoids overhead created by the function call (passing the arguments and retrieving the result) but it may result in a larger executable as the code for the function has to be repeated multiple times.

> Since this meaning of the keyword `inline` is non-binding, compilers are free to use inline substitution for any function that's not marked `inline`, and are free to generate function calls to any function marked `inline`. Those optimization choices do not change the rules regarding multiple definitions and shared statics listed above.

Source : [inline specifier – cppreference.com][1]

What we need to notice from that are the followings:

- `inline` is used to avoid function overhead, replacing the call by the implementation at compile time.
- This keyword is only a ***hint***, not a ***command***, given to the compiler. No matter how you designate a function as `inline`, it is a request that the compiler is ***allowed to ignore***: the compiler **might** inline-expand some, all, or none of the places where you call a function designated as inline (I really wish the keyword will be `maybe_inline` in the future).

With that in mind, let’s take a tour of the pros and the cons of this feature.

## Pros
First of all, even if it is just a ***hint***, the keyword **still** has a chance to influence the compiler. It may not, but it also may. For instance, we can think of the stupidest compiler which will just strictly respect the `inline` keyword, without trying to analyze the context and optimize itself. This is not against the standard (according to the C++11 standard §12.1.5) and the keyword ***is*** useful in this case. Do not get discouraged if that seems to be hopelessly vague. The flexibility of the above is actually a huge advantage: it lets the compiler treat large functions differently from small ones, plus it lets the compiler generate code which is easy to debug if you select the right compiler options.

To be summarized, the pros are:

1. It speeds up your program by avoiding function calling overhead.
2. It saves the overhead of variables' push/pop on the stack when the function is called.
3. It saves the overhead of return call from a function.
4. It increases the locality of reference by utilizing instruction cache.
5. By marking it as inline, you can put a function definition in a header file (i.e. it can be included in multiple compilation units, without the linker complaining).

The first three benefits are overall the main benefits of this feature and the original goal of the introduction of this keyword. Those who know a bit of assembly know that pushing a lot of parameters on the stack to call function can cost more instructions that the function holds.

Point number 4 seems to be a non-negligible side-benefit of this method, but since instruction cache is far from being my specialty, I will not expand on that.

The last one is pro only in certain specific cases, but still pro nonetheless.

## Cons

1. It increases the executable size due to code expansion.
2. C++ inlining is resolved at compile time. This means if you change something in the inlined function, you would need to recompile the whole source codes using the function to make sure it will be updated.
3. When used in a header, it makes your header file larger with information that users do not care about.
4. As mentioned above it increases the executable size, which may cause thrashing in memory. More page faults bring down your program performance.
5. Sometimes inlining is not useful. For example, in the embedded system where large executable size is not preferred at all due to memory constraints.

Points 1 and 4 are the main reasons that inlining functions can decrease performance. These are crucial for keeping in your mind when using this feature.

Point 2 can be a major inconvenience, depending on your project.

In my point of view, point 3 is the main drawback of inlining. In order to have maintainable code, you need to make sure all your code be clear and organized. Inlining is a huge code smell in that regard.

The last one is listed for specific projects, so I won't expand further. But keep in mind that if you have memory constraints, inlining may have consequences.

## Conlusion: When to use the `inline` keyword?

Avoiding function overhead is only useful if you are in a performance-critical part of your code.

We probably already know Pareto’s law:

> 80% of the execution happens in 20% of the code.

That means that the program spends most of its time around bottlenecks. Thus, if you inline code which is not within a bottleneck, this will have little to ZERO effect on your program performance, while increasing its size significantly.

I saw several codebases polluted by useless `inline` in non-critical code. There is absolutely no need in decreasing the readability of your source while increasing its executable sizes.

Here is my opinion:

> **Do not use `inline` until you have proofs from the performance benchmark and you are sure it is inside a bottleneck.**

This is the only way to achieve both efficiency and cleanliness.

## About "All In One Line" code style - another type of inlining

If you are someone who likes to write something like this one:

```cpp
inline auto set_value(const int32_t i) noexcept { value_ = i; }
```

By using the prototype and the implementation all on one line, you prevent several debuggers from doing their jobs properly.

For instance, in Visual Studio, if you put a breakpoint inside the `set_value` method when it's hit, the debugger won’t be able to give you the value of the `value_` variable.

Just stop doing that. It won’t cost you much to add a new line:

```cpp
inline auto set_value(const int32_t i) noexcept {
  value_ = i; // put your breakpoint in here
}
```

[1]: https://en.cppreference.com/w/cpp/language/inline
[2]: https://en.wikipedia.org/wiki/Inline_expansion
