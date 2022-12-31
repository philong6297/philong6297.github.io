+++
author = "longlp"
title = "Dymanic Memory Cost: Allocation Speed"
date = "2022-12-31"
tags = [
    "cpp",
]
+++

# Introduction

When it comes to memory usage, there are two types of programs. The first type are programs that **allocate memory in large blocks**. Normally, these programs know how much memory they will need and can allocate it in advance. They hold their memory in arrays or vectors and typically access it linearly (but not always so). These programs might even use dynamic memory, but when they do, typically they call malloc only a few times during the lifetime of the program. In other words, memory allocation and memory organization are not typically a limiting factor in these programs.

The second type of program uses memory differently. The program might use data structures that require an allocation of a large number of memory chunks using ***malloc*** or ***new***. Or there is might be a message passing going on between different parts of the program and these messages are dynamically allocated. Whatever the case may be, **the program is allocating a large number of small memory chunks, it uses them for some time and then it returns them back to the system**.

When you profile such a program, you might notice that *****malloc*** and ***free*** come up as places where your program is spending time**. Every program spends some time allocating memory, but if this time is too big, this can suggest a performance bottleneck you should investigate if performance is important. **In this post we will talk about the reasons why memory allocation and deallocation are slow and suggest techniques to speed up critical places**.

Please note that there are two things to consider when talking about the performance of programs that use dynamic memory. One is **allocation speed, i.e. how fast can the program allocate and deallocate memory**. This depends mostly on how good are implementations of ***malloc*** or ***free*** (***new*** and ***delete*** in C++).

The other thing is **access speed, i.e. how fast can you access the memory returned by the system allocator**. Access speed depends on hardware memory subsystems and some system allocators are better at allocating memory in a way that benefits hardware memory subsystems.

In this post we will talk about **allocation speed**, and **access speed** will be the topic of a follow-up post.

# Why are ***malloc*** and ***free*** slow?

To answer the above question, we need to first understand how ***malloc*** or ***free*** are commonly implemented. Unless you specifically made the effort, their implementations are provided by the C standard library.

## Memory fragmentation

For most system allocators, the allocator requests one or more large blocks of memory from the operating system. Out of one such block the allocator carves out smaller chunks to service the requests made by programs. There are many algorithms on how to manage smaller chunks out of a large block and they differ in speed (will the allocation be fast) and memory consumption.

<figure>
  <img decoding="async"
    src="/posts/dynamic_memory_cost_allocation_speed/allocator-arena.png"
    data-src="/posts/dynamic_memory_cost_allocation_speed/allocator-arena.png"
    alt="">
  <figcaption>
    <i>
      An example of how an allocator could use a large block to allocate small chunks of memory. Chunks in green are already allocated (taken). When the allocator needs to allocate a new chunk, it traverses the list starting from Free Blocks Start. To optimize for speed the allocator returns the first chunk of appropriate size (first-fit algorithm). To optimize for memory consumption, the allocator returns the chunk whose size most closely matches the chunk size requested by the calling code (best-fit algorithm).
    </i>
  </figcaption>
</figure>

So **one of the reasons why allocators are slow is that the allocation algorithm needs some time to find an available block of a given size**. But that is not all. **As time progresses it gets harder and harder to find the block of the appropriate size**. The reason for this is called memory fragmentation.

To illustrate memory fragmentation, consider the following scenario. The heap consists of five chunks, numbered from 1 to 5 and each 16 bytes in size. Your program allocates all five chunks, and after some time it returns chunks 1, 3 and 4.

<figure>
  <img decoding="async"
    src="/posts/dynamic_memory_cost_allocation_speed/memory-fragmentation-illustration.png"
    data-src="/posts/dynamic_memory_cost_allocation_speed/memory-fragmentation-illustration.png"
    alt="">
  <figcaption>
    <i>
      Illustration of memory fragmentation. Each block is 16 bytes in size. Green blocks are taken, white blocks are available.
    </i>
  </figcaption>
</figure>

If your program would like to allocate a chunk of size 32 bytes (2 consecutive 16-byte chunks), it would need more time to find the block of that size, since it is available at positions 3 and 4. If your program would want to allocate a block of size 48 bytes, this allocation would fail even though there are 48 bytes available in the large block (blocks 1, 3 and 4), but these blocks are not contiguous.

This is a very simplified example and you can imagine what happens when the block your program takes memory from is large and there are many smaller allocations and deallocations. **As time passes, the ***malloc*** and ***free*** functions get slower and slower because the block of appropriate size is more difficult to find**. Moreover, if your program would like to allocate a larger block the allocation might fail because a continuous chunk of the requested size is not available (even though there is enough memory in total).

<figure>
  <img decoding="async"
    src="/posts/dynamic_memory_cost_allocation_speed/memory-fragmentation-real-life.png"
    data-src="/posts/dynamic_memory_cost_allocation_speed/memory-fragmentation-real-life.png"
    alt="">
  <figcaption>
    <i>
      Memory fragmentation on a real-life embedded system. Green blocks are taken, white blocks are available.
    </i>
  </figcaption>
</figure>

**Memory fragmentation is a serious problem for long-running systems**. It causes programs to become slower and slower or to run out of memory. Some time ago we were working on a TV box project. There was a test that changes a channel every 10 seconds for 24 hours. At the beginning of the test, it took 1 second for the video to start running after the channel change command. After 24 hours it took 7 seconds to do the same. Reason? Memory fragmentation.

## Thread Synchronization

In the case of multithreaded programs (and nowadays many programs are multithreaded), ***malloc*** and ***free*** must be thread-safe. The simplest way to make them thread-safe is to introduce mutexes to protect the critical section of those functions, but this comes with a cost. **Mutex locks and unlocks are expensive operations on multiprocessor systems, and even though the allocators can quickly find a memory block of appropriate size, synchronization eats away the speed advantage**.

Many allocators promise a good performance in multithreaded systems. Normally they do it:

- They reserve some memory per-thread. If the block of memory is accessed from a single thread, there is no need for synchronization.
- They maintain a cache of recently used memory chunks per-thread. It removes the need for synchronization for the same reason as above.

Both of the above strategies work well for most programs, but in the case of programs that allocate memory in one thread and release it in another, worst-case runtimes can be bad. Please notice also that these allocation strategies generally increase the program’s memory consumption.

If your program is single-threaded, the allocator might unnecessarily perform thread synchronization that is not needed. In case the performance is important, investigate other allocators that don’t have such an issue.

# Why is the program slow?

There are basically three reasons why your program is slow with regards to the system allocator:

- **Large pressure on the system allocator**: if your program is allocating and releasing a large number of memory chunks, the speed of ***malloc*** and ***free*** will be one of the limiting factors of the program’s performance.

- **Memory fragmentation**: as already explained, the more fragmented the memory, the worse the runtimes of ***malloc*** and ***free***.

- **Inefficient implementation of the system allocator**: the implementation of the system allocator from the standard C library is not necessarily the fastest for your case. If this is true for you, you can consider replacing the system allocator with a faster implementation.

Fixing any of the above reasons for the slower allocations should in principle make your program faster. Also, note that the three items listed are not completely independent of each other, e.g. decreasing the pressure on the system allocator almost always means less memory fragmentation.

# Optimization Strategies

In the following few sections, we will present some techniques that you can use in your program to make it run faster with regards to its usage of dynamic memory. **Most of the techniques presented here require that you know the domain and the lifetime of your projects**. What we will be doing is “fine-tuning” your application, not propose a technique to rewrite the system allocator in a more efficient manner.

## Vector of pointers
In C++, polymorphism can be achieved only using vectors of pointers. However, such a solution puts a huge pressure on the system allocator. Whether it is a vector of raw pointers (```vector<object*>```) or vector of smart pointers (```vector<unique_ptr<object>>```), the result is the same: **for each pointer in the vector, a call to a new (malloc) will need to be made**. Imagine a vector with millions of elements, this translates to million calls to new.

When you have large vector(s) of pointers, you will see performance degradation as the data set grows. This is related both to memory fragmentation and the number of calls to the system allocator.

**A solution to this problem is to use the vector of objects**. All elements of the vector of objects are kept in a large continuous block, which both decreases the pressure on the system allocator and improves data locality (we talk about data locality in the next post).

Vector of objects approach works only if you have one type. However, if you need polymorphism there are several polymorphism libraries that you can search for. Personally, I will choose the implementation from [Microsoft](https://devblogs.microsoft.com/cppblog/proxy-runtime-polymorphism-made-easier-than-ever/)

This approach can drastically decrease the number of calls to the system allocator.

## Custom allocator for your data structure

**Some STL data structures**, notably trees (```std::set``` and ```std::map```), but also hash maps (```std::unordered_set``` and ```std::unordered_map```) and vectors of pointers **will make many requests for small memory chunks from the systems allocator**. This increases memory fragmentation and as a consequence leads to lower performance. **One of the ways to mitigate some of the problems related is to use a custom memory allocator for your STL data structure**.

**STL data structures accept a special STL allocator as one of the template arguments**. When this parameter is specified, the data structure will call special methods of the STL allocators called ``allocate`` and ``deallocate`` to request memory from the allocator and to release the unneeded memory. The user can implement these two functions in any way they like in order to increase the speed.

Please note that, in the case of STL allocators, all the data structures of the same type share one instance of the STL allocator. There is no one instance of STL allocator per instance of data structure. **STL allocators are per-type allocators**.

**The main reason for the speedup with an STL allocator is data separation per domain**. In the case of a regular allocator, memory chunks belonging to completely different data structures may end up next to one another in the memory. With an STL allocator, data from different domains are also in separate memory blocks. There are several advantages of this:

- **All data from the same data structure being in the same memory block increases data locality and access speed**

- **STL allocators can be very simple and therefore very fast**:

  - **The allocator only needs to return chunks of a constant size, or a multiple of constant size**. In the case where the allocator needs to return only chunks of constant size, there is no memory fragmentation because any free element is a perfect fit. Additionally, there is no need for chunk metadata that keeps information about the chunk’s size since the size is already known. Constant size allocators are very easy to implement. Allocators used to parametrize ```std::set```, ```std::map``` and ```std::unique_ptr``` use constant size allocators.
  - **The allocator doesn’t need to be thread-safe** unless the data structure is allocated from several threads.

- **When the data structure gets destroyed, all its memory chunks are returned back to the STL allocator**. Since there is no mixing of data chunks from other unrelated data structures, this decreases memory fragmentation. When all data structures of the same type are destroyed, the STL allocator can return the free block of memory to the operating system.

- **It is much easier to guarantee certain requirements about the allocation**. For example, if two consecutive calls to ```allocate``` return two neighboring chunks in memory, this increases data locality and data access speed later when the data is accessed.
In conclusion, the only reason why would you want to use a custom allocator for your data structure is speed!

### An example STL allocator

STL data structure ``std::map`` (and other STL containers) allows you to specify an allocator as one of the template parameters. If you look up the full definition of ``std::map`` type, you will see the following:

```cpp
template<
    class Key,
    class T,
    class Compare = std::less<Key>,
    class Allocator = std::allocator<std::pair<const Key, T> >
> class map;
```

One of the template parameter is ``Allocator`` and it defaults to ``std::allocator`` (line 5). If you want to replace the allocator of ``std::map``, you will need to write a class with few methods that can serve as a replacement for ``std::allocator``.

So, if you are using ``std::map`` to look up a large number of elements and then you are destroying it soon afterward, you can provide a custom allocator that allocates from one specific block. Here is an example of how to do it:

```cpp
template <typename _Tp>
class zone_allocator
{
private:
    _Tp* my_memory;
    int free_block_index;
    static constexpr int mem_size = 1000*1024*1024;
public:

    zone_allocator()
    {
        my_memory = reinterpret_cast<_Tp*>(mmap(0, mem_size, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0));
        free_block_index = 0;
    }

    ~zone_allocator()
    {
        munmap(my_memory, mem_size);
    }

    ....

    pointer allocate(size_type __n, const void* = 0)
    {
        pointer result = &my_memory[free_block_index];
        free_block_index += __n;
        return result;
    }

    void deallocate(pointer __p, size_type __n)
    {
        // We deallocate everything when destroyed
    }
...
};

std::map<int, my_class, std::less<int>, zone_allocator<std::pair<const int, my_class>>>
```

In the above example, the allocator uses ``mmap`` to allocate a large block of memory from the OS (line 12, don’t worry, it will not allocate all that RAM unless the program actually uses it). The block will get returned back to the system when the instance of ``zone_allocator`` is destroyed (line 18). Method ``allocate`` just returns the first available chunk (lines 25 – 27) in the block and method ``deallocate`` doesn’t do anything. Allocate is fast and deallocate is a no-op.

This approach will be good if we are allocating a complete ``std::map`` at the beginning and then don’t do any removal operations on it. The tree (``std::map`` is **usually** implemented as a red-black tree) will be very compact in memory, which is good for the cache-hit rate and performance. It will not cause any memory fragmentation in the rest of the system since the whole block is separate from memory blocks used by the system allocator.

But if we were removing elements from ``std::map``, even though ``std::map`` would call ``deallocate``, no memory would be released. The program’s memory consumption would go up. If this is the case we would wanto to implement deallocation in ``deallocate`` method, but allocation would need to become more complex as well.

**This type of allocator, where the memory is released back to the system only when the allocator is destroyed, is called a zone allocator (also called bump allocator)**. It can be used as an allocator for data structures that change very little after they are created. Since ***deallocate*** is a no-op, destruction is very fast.

### Per-Instance Allocator

All STL data structures of the same type share one instance of the allocator. And most of the time, this is quite reasonable. For small types (``std::unique_ptr`` or ``std::string``), it doesn’t make sense to have a per-instance allocator, since a per-instance allocator increases the type’s size.

However, if you have several large data structures of the same type, an option would be to have a per-instance allocator. **With a per-instance allocator, all the memory needed for the particular instance of the data structure will be allocated from a dedicated block of memory**. The main benefits of a per-instance allocator are a decrease in memory fragmentation and an increase in data locality. When the instance of the data structure is destroyed, so are all the temporary objects used by it. After that, the whole memory block is empty and can be returned back to the operating system. **Whereas STL allocators separate memory blocks per domain** (every type allocates from its own memory pool), **per-instance allocators separate memory blocks per instance**.

Imagine a class ``student`` which is kept in a hash map. The name of the type would be ``std::map<student_id_t, student>``. You can have two instances of the hash map, one for the undergraduate students, and the other for graduate students. With classic STL allocators, both hash maps would share the same allocator.

**With per-instance allocator, each instance would have its own memory block**. This translates to less memory fragmentation: if we destroy the hash map containing graduate students, we can return the whole block the associated allocator used back to the operating system. Also, the traversal of the hash map is faster due to better data locality. With STL allocator, after destroying the hash map containing graduate students, due to the memory fragmentation, very little memory can be returned back to the operating system.

**Unfortunately, STL data structures do not support per-instance allocators, so in this case you would need to rewrite your data structure to support per-instance allocators.**

### Tuning the custom allocator

As we already said, a custom allocator dedicated to a data structure will allow you to decrease memory fragmentation and increase data locality. But it also comes with additional benefits. **A custom allocator can be adjusted to a specific environment for maximum performance**. Here are a few examples:

- **Static allocator**: if your data structure is small most of the time, e.g. a vector that has most of the time one or two elements, your allocator can be preloaded with enough space to store up to two elements. In case there is a need for more memory, the allocator can request it from the system allocator. This is an optimization for a common case (Stack allocator is closely related to [small size optimizations](#small-size-optmizations) we talk about later in this post), but can substantially decrease the number of calls to the system allocator. This tip applies to per-instance allocators.

- **Zone allocator**: as we already explained, a zone allocator doesn’t deallocate memory, instead all the memory is released when the allocator is destroyed. Very useful for data structures that are mostly static after creation but which allocate a large number of chunks. This approach works for both STL allocators and per-instance allocators.

- **Cache allocator**: a program that has many allocations and deallocation of small objects that are used to pass messages would benefit from caching. When deallocate is called on a memory chunk, the cache allocator would not return it to the system allocator, instead, it would keep a certain number of chunks in its cache. Later, when ``allocate`` is called, the cache allocator would just pop a cached memory chunk if available. Although it doesn’t decrease memory fragmentation completely, this approach can slow it down considerably. This approach works for both STL allocators and per-instance allocators. We talk about a similar caching technique in the next section.

**Knowing your domain will help you pick the right strategy for your custom allocator.**

## Memory chunk caching for producer-consumer

**Imagine a scenario where a producer thread allocates an object and sends it to the consumer thread. After processing the object, the consumer thread destroys the object and releases the memory back to the operating system.**

**This kind of scenario puts a large pressure on the system allocator and increases memory fragmentation. One of the ways you could fix this problem is to allocate all the objects from a dedicated memory pool using a custom allocator.** You could overwrite ``operator new`` and ``operator delete ``methods to use the new allocator.

However, you will need to introduce some kind of synchronization, since the memory for the objects is created and destroyed in two separate threads.

One solution to the synchronization problem is to cache memory chunks both on the allocate end and deallocate end. This decreases the need for synchronization. Take a look at the following source code:

```cpp
template <typename T>
class memory_pool {
    chunk_list<T*> allocate_list_;
    chunk_list<T*> deallocate_list_;
    chunk_list<T*> common_list_;
    std::mutex common_list_mutex_;
public:
    T* allocate() {
        if (allocate_list_.empty()) {
            int move_count;
            int remaining_count;
            common_list_mutex_.lock();
            move_count = allocate_list_.move_to(common_list_, allocate_list_.capacity());
            common_list_mutex_.unlock();

            remaining_count = allocate_list_.capacity() - move_count;
            for (int i = 0; i < remaining_count; i++) {
                allocate_list_.push_front(malloc(sizeof(T));
            }
        }

        return allocate_list_.pop_front();
    }

    void deallocate(T* p) {
        if (deallocate_list_.full()) {
            int remaining_count;
            common_list_mutex_.lock();
            common_list_.move_to(deallocate_list_, deallocate_list_.capacity());
            common_list_mutex_.unlock();

            remaining_count = deallocate_list_.count();
            for (int i = 0; i < remaining_count; i++) {
                free(deallocate_list_.pop_front());
            }
        }

        deallocate_list_.push_front(p);
    }
};
```

Class ``memory_pool`` is a custom allocator used to allocate and deallocate memory using methods ``allocate`` and ``deallocate``. Inside it, there are three linked lists containing the cached memory chunks: ``allocate_list_``, ``common_list_`` and ``deallocate_list_`` (lines 3 – 5).

**When ``memory_pool::deallocate`` is called, the memory chunk is not released back to the system allocator, instead is cached**, i.e. it is put into ``deallocate_list_`` (this is the common case, line 38).

- **If ``deallocate_list_`` is full, then all the memory chunks in the ``deallocate_list_`` are moved to ``common_list``** (line 29). When the ``common_list_`` becomes full, then the remaining memory chunks are released back to the system allocator (lines 33-35). After this operation ``deallocate_list_`` is empty.
- Only access to ``common_list_`` has to be secured with a mutex (lines 28 and 30).
- We can expect to access only ``deallocate_list_`` most of the time, we only need to access ``common_list_`` when ``deallocate_list_`` is full.

**When ``memory_pool::allocate`` is called, if available, a memory chunk is taken from the cache, i.e. returned from the ``allocate_list_``** (this is the common case, line 22).

- **If ``allocate_list_`` is empty, then additional memory chunks are taken from the common_list_** (line 13). The ``memory_pool`` will move as many chunks as possible from the ``common_list_`` to the ``allocate_list_``, until ``allocate_list_`` is full.
- If the ``allocate_list_`` is not full after this operation, additional memory chunks will be requested from the system allocator to make the list full (lines 17 – 19).
- Only access to ``common_list_`` has to be secured with a mutex (lines 12 and 14).
- We can expect to access ``allocate_list_`` most of the time, we only need to access ``common_list_`` when ``allocate_list_`` is empty.

This solution works only with two threads, one thread that exclusively allocates and the other thread exclusively deallocates objects.

For efficiency, the capacities of ``allocate_list_``, ``deallocate_list_`` and ``common_list_`` need to be chosen carefully. Small values make the allocator useless, as most of the time it is working with the system allocator instead of the cached chunk lists. A large value makes the program consume more memory. The capacity of ``common_list_`` should be several times bigger than the capacity of two other lists.

You can construct an object on a predefined piece of memory using following syntax:

```cpp
memory_pool<object> pool;

// Allocation and construction
object* my_object = pool.allocate();
new (my_object) object(0);

// Destruction and deallocation
my_object->~object();
pool.deallocate(my_object);
```

On line 4 we allocate memory for the object, but only on line 5 we call the constructor. The piece of the memory on which the object is created is given in parenthesis, after the keyword ``new``. On line 8 we explicitly call the constructor. The object is destroyed, but the memory is not released back. We release the memory back to the pool on line 9.

Alternatively, you can override ``operator new`` and ``operator delete``, like this:

```cpp
class object {
private:
    static memory_pool<object> m_pool;
public:
    void * operator new(size_t size) {
        return m_pool.allocate();
    }

    void operator delete(void * p) {
       m_pool.deallocate(p);
    }
};
```
This will make every object created using ``new`` and destroyed using ``delete`` allocated using memory from the memory pool.

## Small Size Optmizations
Let’s take an example of a custom class ``small_int_vector`` that stores integers. And, let’s say, that in 99% of the time an instance this class will store zero, one, or two elements. Here is the source code of a naive implementation:

```cpp
class small_int_vector {
private:
    int* m_data;
    size_t m_size;
    size_t m_capacity;
public:
    small_int_vector(size_t capacity) {
        m_size = 0;
        m_capacity = capacity;
        m_data = malloc(sizeof(int) * capacity);
    }

    int& operator[](size_t index) {
        return m_data[index];
    }
};
```

If you have many instances of the ``small_int_vector``, for each instance there will be a call to the system allocator requesting a really small chunk of memory. What we could do, is that **we could preallocate two integers as a part of the class and thus completely avoid calls to the system allocator**. The code now looks like this:

```cpp
class small_int_vector {
private:
    int* m_data;
    size_t m_size;
    size_t m_capacity;

    static constexpr int static_capacity = 2;
    int m_preallocated[static_capacity];
public:
    small_int_vector(size_t capacity) {
        m_size = 0;
        if (capacity <= static_capacity) {
            m_capacity = static_capacity;
            m_data = m_preallocated;
        } else {
            m_capacity = capacity;
            m_data = malloc(sizeof(int) * capacity);
        }
    }

    int& operator[](size_t index) {
        return m_data[index];
    }
};
```

In the above code, the array ``m_preallocated`` holds a preallocated piece of memory we can use to avoid the call to the system allocator. If we are creating ``small_int_vector`` with the capacity less than or equal to ``static_capacity`` (lines 12-14), we use the ``m_preallocated`` array to store the data, otherwise, we take additional memory from the heap (by calling the system allocator, lines 16-17).

The downside of this approach is the increase in class size. On 64 bit system, the original class was 24 bytes in size, the new class is 32 bytes in size. Luckily, we can have both small size and small buffer optimizations in the same package with a trick.

**We can use C unions to overlay the data for the preallocated case and for the heap-allocated case**. We use the most significant bit in data member ``m_size`` to disambiguate between the preallocated case and heap-allocated case. Here is the source code:

```cpp
class small_int_vector {
   private:
    static constexpr int static_capacity = 4;
    static constexpr size_t heap_size_mask = 1ull << (sizeof(size_t) * 8 - 1);

    union data_t {
        struct {
            int* m_data;
            size_t m_capacity;
        } m_heap_data;

        int m_preallocated[static_capacity];
    };

    data_t m_data;
    size_t m_size;

   public:
    small_int_vector(size_t capacity) {
        if (capacity > static_capacity) {
            m_data.m_heap_data.m_capacity = capacity;
            m_data.m_heap_data.m_data = (int*)malloc(sizeof(int) * capacity);
            m_size = 0 | heap_size_mask;
        } else {
            m_size = 0;
        }
    }

    bool is_preallocated() { return (m_size & heap_size_mask) == 0; }

    int& operator[](size_t index) {
        if (is_preallocated()) {
            return m_data.m_preallocated[index];
        } else {
            return m_data.m_heap_data.m_data[index];
        }
    }

    size_t size() { return m_size & (~heap_size_mask); }
};
```

If the most significant bit in ``m_size`` is zero, we are using the preallocated memory from the array ``m_preallocated`` (line 12). If the most significant bit in ``m_size`` is one, we are using heap-allocated memory stored in the pointer ``m_heap_data.m_data`` (line 8).

This approach is used in several places. For example, [libc++ implements std::string in this way](https://joellaity.com/2020/01/31/string.html).

## Other approaches for fighting memory fragmentation

Here we present an few other approaches you can use to fight memory fragmentation:

- **Restart**: there are systems that will occasionally restart in order to avoid memory fragmentation. Creating a program or a system that is restartable and that will restore its state after restart can be a challenge.
- **Preallocate memory upfront**: Some programs preallocate all the needed memory at start time and then completely dispense with dynamic memory allocation. For example, MISRA coding guidelines used in the automotive industry do not allow the usage of dynamic memory. The problem with this approach, however, is that for some programs it is not possible to allocate all memory in advance because the amount of needed memory is not known at program beginning.
- **Change the system allocator**: there are several open-source system allocators that can be used instead of the built-in one, and which promise faster allocation speed, better memory usage, less fragmentation or better data locality. We talk about this in the next chapter.


# System Allocators

The techniques mentioned up to this point are domain-specific. **In this section we talk about another way to speed up your program: by using a better system allocator**. On Linux, there are several open-source allocators that try to solve the problem of efficient allocation and deallocation, but no allocator, as far as I know, can solve all the problems completely.

When you are picking a system allocator for your system, there are four properties that each allocator compromises on:

- **Allocation speed**: the speed at which you can request and release chunks from the allocator. Note that both the speed of malloc and free are important.
- **Memory consumption**: what percentage of memory gets wasted with each allocated chunk. The allocator needs to keep some accounting info for each block, normally this takes up some space. Additionally, if the allocator optimizes for allocation speed it can leave some memory unused.
- **Memory fragmentation**: Some allocators are more prone to memory fragmentation issues than others, which can impact the speed of long-running applications.
- **Cache locality**: when the chunk gets out of the allocator, we would like for it to be in the data cache since this increases access speed later. Allocators that pack their data in smaller blocks and avoid memory losses will generally have better cache locality properties. We will talk about this in a follow-up article since this is a topic of its own accord.

## Allocators on Linux

**When you use malloc and free in your program (or new and delete in C++), normally it is the C standard library that implements those functions**. Its allocator is called ***GNU allocator*** and it is based on ***ptmalloc***. Apart from it, there are several other open-source allocators commonly used on Linux: [tcmalloc](https://goog-perftools.sourceforge.net/doc/tcmalloc.html) (by Google), [jemalloc](https://jemalloc.net/) (by Facebook), [mimalloc](https://github.com/microsoft/mimalloc) (by Microsoft), [hoard allocator](http://hoard.org/), [ptmalloc](http://www.malloc.de/en/) and [dlmalloc](https://gee.cs.oswego.edu/dl/html/malloc.html).

GNU allocator is not among the most efficient allocators. However it does have one advantage, the worst-case runtime and memory usage will not be too bad. But the worst case happens rarely and it is definitely worth investigating if we can do better.

Other allocators claim to be better in speed, memory usage or cache locality. Still, when you are picking the right one for you, you should consider:

- Is your program single-thread or multi-threaded?
- Do you need maximum allocation speed or minimum memory consumption? What kind of trade-off are you willing to make between these two?
- Do you want to replace the allocator for the whole program or only for the most critical parts?

If you are running under Linux, allocators are available in your distribution’s repositories. You don’t need to recompile your application in order to benefit from the allocator. You can use an environment variable ``LD_PRELOAD`` to replace the default allocator with a custom one. You can use this trick to quickly check if the allocator fits your needs:

```bash
$ LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libtcmalloc_minimal.so.4  ./my_program
```

In the above example, we use ``LD_PRELOAD`` to overwrite the GNU allocator with ``tcmalloc``.

## The system allocator test

Well, this time there will not be any experiments. The reason is simple: real-world programs differ too much from one another. An allocator that performs well under one load might have different behavior under another load.

If you are interested in seeing the number, I suggest you visit [Testing Memory Allocators: ptmalloc2 vs tcmalloc vs hoard vs jemalloc While Trying to Simulate Real-World Loads](http://ithare.com/testing-memory-allocators-ptmalloc2-tcmalloc-hoard-jemalloc-while-trying-to-simulate-real-world-loads/). The author has compared several allocators on a test load that tries to simulate a real-world load. We will not repeat the results of his analysis here, but his conclusion matches ours: allocators are similar to one another and testing your particular application is more important than relying on synthetic benchmarks.

## A few more words on using allocators in your program

**All the allocators can be fine-tuned to run better on a particular system**, but the default configuration should be enough for most use cases. Fine-tuning can be done at compile-time or run-time, through environment variables, configuration files or compilation options.

Normally the allocators provide implementations for ***malloc*** and ***free*** and will replace the functions with the same name provided by Standard C library. This means that every dynamic allocation your program makes goes through the new allocator.

However, it is possible to keep default ***malloc*** and ***free*** implementations together with custom implementations provided by your chosen allocator. Allocators can provide prefixed versions of ***malloc*** and ***free*** for this purpose. For example, ``jemalloc`` allows you to provide a custom prefix for ***malloc*** and ***free***. If you specify prefix ``je_``, the allocator will provide functions ``je_malloc`` and ``je_free``. In this case, ***malloc*** and ***free*** will be left unchanged, and you can use ``je_malloc`` and ``je_free`` to allocate memory only for some parts of your program through ``jemalloc``.

# Final words

We presented several techniques on how to make your program allocate memory faster. **Off-the-shelf allocators have the benefit of being very easy to set up and you can see the improvements within minutes**. However, you will need to introduce new libraries to your program which can sometimes pose a problem.

**Other techniques presented are also very powerful when used correctly**. Just decreasing the number of allocations by avoiding pointers removes a lot of stress from the system allocator (as seen with vectors of pointers). Custom allocators will help you get a better allocation speed and help you decrease memory fragmentation. Other techniques also have their place in making your program run faster, depending on the problem at hand.

**Each of these techniques solves the question of allocation a bit differently and at the end of the day, it is your program and your requirements that will help you pick the best one.**

# Further Read
[Scaleable memory allocation using jemalloc](https://www.facebook.com/notes/10158791475077200/)
