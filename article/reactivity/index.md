# 浅析Vue3中的响应式原理

请在此前阅读[Vue Composition API](https://vue-composition-api-rfc.netlify.com/)内容，熟悉一下api。

## 实现响应式的方式

1. [defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)
2. [Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

众所周知在Vue3中使用了ES6提供的`Proxy`API取代了之前defineProperty来实现对数据的侦测.

## 为啥使用Proxy?

我们知道在Vue2对于监测数组的变化是通过重写了数组的原型来完成的，这么做的原因是:

1. 不会对数组每个元素都监听，提升了性能.(`arr[index] = newValue`是不会触发试图更新的,这点不是因为defineProperty的局限性，而是出于性能考量的)
2. defineProperty不能检测到数组长度的变化，准确的说是通过改变length而增加的长度不能监测到(`arr.length = newLength`也不会)。

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

## 实现响应式前的一些小细节

相对于defineProperty，Proxy无疑更加强大，可以代理数组，并且提供了多种属性访问的方法traps(get,set,has,deleteProperty等等)。
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
但是对于数组的一次操作可能会触发多次get/set,主要原因自然是改变数组的内部key的数量了(即对数组进行插入删除之类的操作),导致的连锁反应。
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
同时Proxy是仅代理一层的，对于深层对象，也是需要开发者自行实现的，此外对于对象的添加是可以`set`traps侦测到的，删除则需要使用`deleteProperty`traps。
```js
let data = {a:1,b:{c:'c'},d:[1,2,3]}
let p = new Proxy(data, {
    ....同上
})
console.log(p.a)
console.log(p.b.c)
console.log(p.d)
console.log(p.d[0])
p.e = 'e'  // 这里可以看到给对象添加一个属性也依然可以侦测到变化
// get value: a
// 1
// get value: b
// c
// get value: d
// [1, 2, 3]
// get value: d
// 1
// set value: e e
```
还有一件事，对于一些简单的get/set操作，我们在traps中使用`target[key]`，`target[key] = value`是可以达到我们的需求的，但是对于一些复杂的如delet，in这类操作这样实现就不够优雅了，而ES6提供了[Reflect](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect)API,且与Proxy的traps一一对应,用来代替 Object 的默认行为。
所以我们先将之前的代码改造一下:

```js
let p = new Proxy(data, {
    get(target, key, receiver) {
        console.log('get value:', key)
        const res = Reflect.get(target, key, receiver)
        return res
    },
    set(target, key, value, receiver) {
        console.log('set value:', key, value)
        // 如果赋值成功，则返回true
        const res = Reflect.set(target, key, value, receiver)
        return res
    }
})
```

## 实现响应式

### 明确实现的效果

```js
const value = reactive({ num: 0 })
effect(() => {
  console.log(value.num)
})
value.num = 7 // 这时会打印 7

const list = reactive([1,2])
effect(() => {
  console.log(list)
})
list.push(3) 
// 这时会打印 [1,2,3]
```
### 第一步，我们先来简单实现一个可以对对象增删改查侦测的函数

在set的实现中，我们将对象的set分为两类：新增key和更改key的value。通过hasOwnProperty判断这个对象是否含有这个属性，不存在存在则是添加属性，存在则判断新value和旧value是否相同，不同才需要触发log执行。

```js
const hasOwn = (val,key)=>{
    const res = Object.prototype.hasOwnProperty.call(val, key)
    console.log(val,key,res)
    return res
} 

function reactive(data){
    return new Proxy(data, {
        get(target, key, receiver) {
            console.log('get value:', key)
            const res = Reflect.get(target, key, receiver)
            return res
        },
        set(target, key, value, receiver) {
            const hadKey = hasOwn(target, key)
            const oldValue = target[key]
            const res = Reflect.set(target, key, value, receiver)
            if (!hadKey) {
                console.log('set value:ADD', key, value)
            } else if (value !== oldValue) {
                console.log('set value:SET', key, value)
            } 
            return res
        },
        deleteProperty(target, key){
            const hadKey = hasOwn(target, key)
            const oldValue = target[key]
            const res = Reflect.deleteProperty(target, key)
            if (hadKey) {
                console.log('set value:DELETE', key)
            }
            return res
        }
    })
}
```
### 深层监听







### 解决多次trigger的问题

但对于数组进行一些操作时，执行起来会有一点小不同,我们来监听一个数组`p = reactive([1,2,3])`,并分别对p进行操作看看结果:

```js
p.push(1)
// set value:ADD 3 1
p.unshift(1)
// set value:ADD 3 3
// set value:SET 2 2
// set value:SET 1 1
p.splice(0,0,2)
// set value:ADD 3 3
// set value:SET 2 2
// set value:SET 1 1
// set value:SET 0 2
p[3] = 4
// set value:ADD 3 4
--------
p,pop()
// set value:DELETE 2
// set value:SET length 2
p.shift()
// set value:SET 0 2
// set value:SET 1 3
// set value:DELETE 2
// set value:SET length 2
delete p[0]
// set value:DELETE 0
// 这里p的length依然是三
```
可以发现当我们对数组添加元素时，对于length的SET并不会触发(),而删除元素时才会触发length的SET,同时对数组的一次操作触发了多次log，接下来我们来解决这些:






