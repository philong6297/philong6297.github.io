+++
author = "longlp"
title = "About inlining"
date = "2021-11-20"
description = "Yet another pamphlet about inlining"
tags = [
    "cpp",
]
+++

## Introduction

For me, everytime I encounter the stituation and document myself about, I still end up with the same conclusions:
> Inlining is often to be misused in development, ending up in counter-productive and risky situations.

I will try to summarize all the things which I believe we need to remember about inlining, giving pros, cons and situations to use it and to not use it.

## Definition
From the C++ standard definition of `inline`:

> The original intent of the `inline` keyword was to serve as an indicator to the optimizer that [inline substitution of a function][2] is preferred over function call, that is, instead of executing the function call CPU instruction to transfer control to the function body, a copy of the function body is executed without generating the call. This avoids overhead created by the function call (passing the arguments and retrieving the result) but it may result in a larger executable as the code for the function has to be repeated multiple times.

> Since this meaning of the keyword `inline` is non-binding, compilers are free to use inline substitution for any function that's not marked `inline`, and are free to generate function calls to any function marked `inline`. Those optimization choices do not change the rules regarding multiple definitions and shared statics listed above.

Source : [inline specifier – cppreference.com][1]

What we need to notice from that are two things :

- `inline` is used to avoid function overhead, replacing the call by the implementation at compile time.
- It is only a ***hint***, not a ***command***, given to the compiler. Some functions declared inline may not really be inlined, and vice-versa (I really wish the keyword will be `maybe_inline` in the future).

With that in mind, let’s take a tour of the pros and the cons of this feature.

## Pros
First of all, even if it’s a ***hint***, the keyword **still** has a chance to influence the compiler. It may not, but it also may. For instance, we can think of the stupidest compiler that will just strictly respect the `inline` keyword, without trying to analyze the context and optimize himself. This is not against the standard (according to the C++11 standard §12.1.5) and the keyword ***is*** useful in this case.

To be summarized, the pros are:

1. It speeds up your program by avoiding function calling overhead.
2. It save overhead of variables push/pop on the stack, when function calling happens.
3. It save overhead of return call from a function.
4. It increases locality of reference by utilizing instruction cache.
5. By marking it as inline, you can put a function definition in a header file (i.e. it can be included in multiple compilation unit, without the linker complaining).

The first three benefits are overally the main benefits of this feature, and the original goal of the introduction of this keyword. Those who know a bit of assembly know that pushing a lot of parameters on the stack to call function can cost more instructions that the function holds.

Point number 4 seems to be a non-negligible side-benefit of this method, but since instruction cache is far from being my specialty, I will not develop on this.

The last one is pro only in certain specific cases, but still a pro nonetheless.

## Cons

1. It increases the executable size due to code expansion.
2. C++ inlining is resolved at compile time. Which means if you change the code of the inlined function, you would need to recompile all the code using it to make sure it will be updated
3. When used in a header, it makes your header file larger with information which users don’t care.
4. As mentioned above it increases the executable size, which may cause thrashing in memory. More number of page fault bringing down your program performance.
5. Sometimes inlining is not useful. For example, in embedded system where large executable size is not preferred at all due to memory constraints.

Points 1 and 4 are the main reason that function inlining can decrease performance. It is important to remember that when using this feature.

Point 2 can be a major inconvenient, depending on your project.

Point 3 is, in my opinion, the main drawback of inlining. In order to have maintainable code you need to have to be clear and organized. Inlining is a huge code smells in that regard.

The last one is about specific projects, so I will not develop further. But keep in mind that if you have memory constraints, inlining may have consequences.

## Conlusion : when to use the inline keyword ?
Avoiding function overhead is only usefull if you are in a performance critical part of your code.

We probably already know the Pareto’s law:
> 80% of the execution happens in 20% of the code.

This means that the program spends most of it’s time in bottlenecks. Thus, if you inline code that is not within a bottleneck, this will have little to no effect on your program performance, while increasing its size.

I saw several codebases polluted by useless `inline`s in non-critical code. There is absolutly no need in decreasing the readability of the code and increasing the executable size for that end.

Here is my oponion:

> **do not use `inline` until you have proofs from performance benchmark and you are sure it is inside a bottleneck.**

This is the only way to be both efficient and clean.

## About "All In One Line" code style - another type of inlining
If you are someone who likes to write something like this one:

```cpp
inline auto set_value(const int32_t i) noexcept { value_ = i; }
```

By using the prototype and the implementation all on one line, you prevent several debuggers from doing their jobs properly.

For instance, in Visual Studio, if you put a breakpoint inside this `set_value` method, when it hits the debugger won’t be able to give you the value of `value_`.

Just stop doing that. It won’t cost you much to add a newline:
```cpp
inline auto set_value(const int32_t i) noexcept {
  value_ = i; // put your breakpoint in here
}
```

[1]: https://en.cppreference.com/w/cpp/language/inline
[2]: https://en.wikipedia.org/wiki/Inline_expansion
