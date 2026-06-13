---
title: STL容器函数速查笔记
date: 2026-03-22
description: 核心记忆逻辑： 按容器类型记，而非死背函数名 线性数组 / 链表：用 push back / push front 栈 / 队列 / 堆：只用 push / pop 集合 / 映射：只用 insert ，无 push 系列
category: 题解
tags:
  - STL
gameUrl: 
---

# STL容器函数速查笔记

> 核心记忆逻辑：**按容器类型记，而非死背函数名**
> 
> - 线性数组 / 链表：用 `push_back`/`push_front`
> 
> - 栈 / 队列 / 堆：只用 `push`/`pop`
> 
> - 集合 / 映射：只用 `insert`，无 push 系列
> 
> 

---

## 一、线性容器（数组 / 双端 / 链表）

这类容器是线性结构，支持头尾 / 中间位置的灵活操作。

### 1. vector（动态数组）

最常用的动态数组，仅支持高效尾插，中间插入效率低。

```cpp

// 插入
v.push_back(x);  // 尾插（唯一高频插入）
v.insert(it, x); // 任意位置插入（it为迭代器）
// 删除
v.pop_back();    // 尾删
v.erase(it);     // 任意位置删除
```

💡 记忆：数组只往尾巴推，**没有 ** **`push()`**

### 2. string（字符串）

和 vector 逻辑完全一致，字符版的动态数组。

```cpp

// 插入
s.push_back(c);  // 尾插字符
s.append(str);   // 尾插字符串
s.insert(pos, x);// 任意位置插入
// 删除
s.pop_back();    // 尾删
s.erase(pos, len);// 删除指定长度字符
```

### 3. deque（双端队列）

头尾都能高效操作的双端队列。

```cpp

// 插入
d.push_front(x); // 头插
d.push_back(x);  // 尾插
// 删除
d.pop_front();   // 头删
d.pop_back();    // 尾删
```

💡 记忆：双端两头推，头尾都能插

### 4. list（双向链表）

支持任意位置高效插入删除的链表。

```cpp

// 插入
l.push_front(x); // 头插
l.push_back(x);  // 尾插
l.insert(it, x); // 中间插入
// 删除
l.pop_front();   // 头删
l.pop_back();    // 尾删
l.erase(it);     // 任意位置删除
```

---

## 二、容器适配器（栈 / 队列 / 优先队列）

这类容器是封装好的适配器，**只有一个操作口**，函数完全统一。

### 1. stack（栈）

后进先出（LIFO），仅能操作栈顶。

```cpp

// 插入
s.push(x);       // 压入栈顶（唯一插入方式）
// 删除
s.pop();         // 弹出栈顶
// 访问
s.top();         // 取栈顶元素
```

### 2. queue（普通队列）

先进先出（FIFO），仅能队尾入、队头出。

```cpp

// 插入
q.push(x);       // 入队尾（唯一插入方式）
// 删除
q.pop();         // 弹出队头
// 访问
q.front();       // 取队头
q.back();        // 取队尾
```

### 3. priority_queue（优先队列 / 堆）

大顶堆 / 小顶堆，仅能操作堆顶。

```cpp

// 插入
pq.push(x);      // 入堆（唯一插入方式）
// 删除
pq.pop();        // 弹出堆顶
// 访问
pq.top();        // 取堆顶元素
```

💡 记忆：**栈 / 队列 / 堆，通通只有 ** **`push`** **，没有 ** **`push_back`**

---

## 三、关联容器（集合 / 映射）

这类容器是树 / 哈希表结构，不是线性结构，**没有 push 系列函数**，统一用`insert`。

### 1. set / unordered_set

有序 / 无序集合，存储唯一元素。

```cpp

// 插入
s.insert(x);     // 插入元素
// 删除
s.erase(x);      // 删除元素
// 查找
s.count(x);      // 判断元素是否存在
s.find(x);       // 查找元素迭代器
```

### 2. map / unordered_map

有序 / 无序键值对映射。

```cpp

// 插入
m.insert({key, val}); // 插入键值对
m[key] = val;         // 直接赋值（最常用）
// 删除
m.erase(key);         // 删除键
// 访问
m[key];               // 访问键对应的值
```

💡 记忆：**集合映射不排队，只 ** **`insert`** **，不 ** **`push`**

---

## 四、速查总表

|容器|核心插入函数|核心删除函数|一句话记忆|
|---|---|---|---|
|vector|`push_back(x)`|`pop_back()`|数组只往尾巴推|
|string|`push_back(c)`/`append()`|`pop_back()`|字符版 vector|
|deque|`push_front(x)`/`push_back(x)`|`pop_front()`/`pop_back()`|双端两头推|
|list|`push_front(x)`/`push_back(x)`|`pop_front()`/`pop_back()`|链表任意插|
|stack|`push(x)`|`pop()`|栈顶操作|
|queue|`push(x)`|`pop()`|队尾入队头出|
|priority_queue|`push(x)`|`pop()`|堆顶操作|
|set/unordered_set|`insert(x)`|`erase(x)`|集合用 insert|
|map/unordered_map|`insert({k,v})`/`m[k]=v`|`erase(k)`|映射用 insert|
---

## 五、最容易混的 3 个坑

1. ❌ **vector 没有 ** **`push()`**，只有 `push_back()`

2. ❌ **stack/queue 没有 ** **`push_back()`**，只有 `push()`

3. ❌ **set/map 没有任何 push 函数**，只有 `insert()`
> （注：文档部分内容可能由 AI 生成）
