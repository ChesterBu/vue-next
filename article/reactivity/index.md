# 浅析Vue3中的响应式原理

请在此前阅读[Vue Composition API](https://vue-composition-api-rfc.netlify.com/)内容，熟悉一下api。

## 实现可响应对象的方式

1. [defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)
2. [Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

众所周知在Vue3中使用了ES6提供的 Proxy API取代了之前defineProperty来实现对数据的侦测.

## 为啥使用Proxy?

我们知道在Vue2对于监测数组的变化是通过重写了数组的原型来完成的，这么做的原因是:

1. 不会对数组每个元素都监听，提升了性能.(arr\[index\] = newValue是不会触发试图更新的,这点不是因为defineProperty的局限性，而是出于性能考量的)
2. defineProperty不能检测到数组长度的变化，准确的说是通过改变length而增加的长度不能监测到(arr.length = newLength也不会)。

同样对于对象，由于defineProperty的局限性，Vue2是不能检测对象属性的添加或删除的。
```js
    function defineReactive(data, key, val) {
        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: true,
            get() {
                console.log(`get key: ${key} val: ${val}`)
                return val
            },
            set(newVal) {
                console.log(`set key: ${key} val: ${newVal}`)
                val = newVal
            }
        })
    }
    function observe(data) {
        Object.keys(data).forEach((key)=> {
            defineReactive(data, key, data[key])
        })
    }
    let test = [1, 2, 3]
    observe(test)
    console.log(test[1])   // get key: 1 val: 2
    test[1] = 2       // set key: 1 val: 2
    test.length = 1   // 操作是完成的,但是没有触发set
    console.log(test.length) // 输出1，但是也没有触发get
```

## Proxy
相对于defineProperty，Proxy无疑更加强大，可以代理数组，并且提供了多种属性访问的方法traps。

```js
    let data = [1,2,3]
    let p = new Proxy(data, {
        get(target, key, receiver) {
            // target 目标对象，这里即data
            console.log('get value:', key)
            return target[key]
        },
        set(target, key, value, receiver) {
            // receiver 最初被调用的对象。通常是proxy本身，但handler的set方法也有可能在原型链上或以其他方式被间接地调用（因此不一定是proxy本身）。
            // 比如，假设有一段代码执行 obj.name = "jen"，obj不是一个proxy且自身不含name属性，但它的原型链上有一个proxy，那么那个proxy的set拦截函数会被调用，此时obj会作为receiver参数传进来。
            console.log('set value:', key, value)
            target[key] = value
            return true // 在严格模式下，若set方法返回false，则会抛出一个 TypeError 异常。
        }
    })
    p.length = 4   // set value: length 4
    console.log(data)   // [1, 2, 3, empty]
```
但是对于数组的一次操作可能会触发多次get/set,主要原因自然是改变数组的内部key的数量了（即对数组进行插入删除key之类的操作），导致的连锁反应。
```js
// data : [1,2,3]
p.push(1)
// get value: push
// get value: length
// set value: 3 1
// set value: length 4
// data : [1,2,3]
p.shift()
// get value: shift
// get value: length
// get value: 0
// get value: 1
// set value: 0 2
// get value: 2
// set value: 1 3
// set value: length 2
```
同时Proxy也是仅代理一层的

