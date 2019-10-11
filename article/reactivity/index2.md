# 浅析Vue3中的响应式原理(2)

在上篇[文章](https://github.com/ChesterBu/vue-next/blob/master/article/reactivity/index.md)中我们简单实现了reactive以及effect,在本章中,我们来了解并实现下ref以及computed

## ref

直接上代码:

```js

const count = ref(0)
console.log(count.value) // 0

count.value++
console.log(count.value) // 1
----------
const a = ref(1)
effect(() => {
    console.log(a.value)
})
a.value = 2
// 2
```
我们知道现在是没有办法使基本数据类型变为响应式的数据的(Vue3中只可以监听Object|Array|Map|Set|WeakMap|WeakSet这几种,Proxy也没法劫持基本数据).那我们如果就想让一个基本数据变为响应式的咋办？
怎么办？把传入的基本数据包装成对象就好啦。
```js
const convert = (val: any): any => (isObject(val) ? reactive(val) : val)

function ref(raw){
  if (isRef(raw)) {     //如果已经是ref类型的数据就直接返回,不会重复包裹
    return raw
  }
  raw = convert(raw)
  const v = {
    [refSymbol]: true,   // 这个Symbol标记就是用于判断是否为ref数据
    get value() {
        // 注意！ 这里ref绑定的key为‘’(空字符串),这个是可以的因为用的是Map存储。
      track(v, OperationTypes.GET, '')
      return raw
    },
    set value(newVal) {
      raw = convert(newVal)
      trigger(v, OperationTypes.SET, '')
    }
  }
  return v
}
```
是不是觉得那尼？？？(黑人问号脸),我自己写个{value:0}对象传reactive不也一样的效果嘛？
别急ref的作用肯定不止这个,我们来看另一个场景.

## 响应式的丢失

首先看一段代码:

```js
let obj = {
    a:1,
    b:2
}
let { a, b } = obj
a = 2
// 请问此时 obj.a的值是？
---------------------
let obj = {
    a:1,
    b:2
}
function cc () {
    return { ...obj2 }
}
let { a,b } = cc()
obj2.a = 2
// 请问此时a的值是？
```

上面的答案无疑都是1.
原因是我们在**对象解构**和**扩散运算符**时,对原对象的引用都会丢失.
同样对于响应式的数据:

```js
function useMousePosition() {
  const pos = reactive({
    x: 0,
    y: 0
  })
  // ...
  return pos
}

// consuming component
export default {
  setup() {
    // 响应式丢失!
    const { x, y } = useMousePosition()
    return {
      x,
      y
    }
    -------------
    // 响应式丢失!
    return {
      ...useMousePosition()
    }
    -------------
    // 这是唯一能够保持响应式的办法,必须返回原先的引用
    return {
      pos: useMousePosition()
    }
  }
}
```
蛤？？？还会这样？那可咋整啊？
Vue3为我们提供了一个函数便是用于这种情况:
```js
// 接收的参数为一个响应式的数据
export function toRefs(
  object
){
  const ret: any = {}
  for (const key in object) {
    ret[key] = toProxyRef(object, key)
  }
  return ret
}

function toProxyRef(
  object,
  key
) {
    // 注意这个地方没有实现track和trigger
  return {
    [refSymbol]: true,
    get value(): any {
      return object[key]
    },
    set value(newVal) {
      object[key] = newVal
    }
  }
}

```

用法:

```js
function useMousePosition() {
  const pos = reactive({
    x: 0,
    y: 0
  })

  // ...
  return toRefs(pos)
}

// x & y 现在就是ref类型了!
const { x, y } = useMousePosition()
```

### ref小结

其实本节的主要内容都可以通过阅读[Ref vs. Reactive](https://vue-composition-api-rfc.netlify.com/#ref-vs-reactive)获得,我也只是按照我的理解写了一下ORZ。

比较有意思的地方是ref是可以传入对象的,对象会被转成reactive的,看下看这段代码:

```js
const {ref,reactive, effect} = VueObserver
const a = ref({c:1})
effect(()=>{
    console.log(a.value.c)
})
a.value.c = 2  // 打印2
a.value = {c:3}  // 打印3
```

这里在执行effct函数时其中的`()=>{ console.log(a.value.c)}`ReactiveEffect其实会被分别存在key为“”（ref存ReactiveEffect的key都是""）和key为c的的depSet中,因为同时get了value和c。
所以修改c和value都会触发相同的ReactiveEffect的执行。

## computed

用过Vue的肯定都对computed很熟悉啦,我就不解释是啥意思了,看下Vue3的用法

```js
const value = reactive({ foo: 0 })
const c1 = computed(() => value.foo)
const c2 = computed(() => c1.value + 1)
c2.value  // 1
c1.value  // 0
value.foo++
c2.value  // 2
c1.value  // 1
-------------
const n = ref(1)
const plusOne = computed({
    get: () => n.value + 1,
    set: val => {
    n.value = val - 1
    }
})
plusOne.value // 2
plusOne.value = 1  // n.value : 0
```

先试着自己实现一版:

```js
function computed(getter,setter=()=>{}){
    return {
        get value(){
            return getter()
        },
        set value(newValue){
            setter(newValue)
        }
    }
}
let a = 1
let b = computed(()=> a+1)
console.log(b.value) // 2
a = 2
console.log(b.value)  // 3
let c = computed(()=>b.value+1,(newValue)=>{a=0})
c.value = -1
console.log(a)  // 0
```
好像没什么问题哦？但是(此处应配可达鸭眉头一皱,发现事情并不简单,但是我懒得配。。。)



## 题外话

在看源码的经常会看到这样的代码:
```js

if (__dev__){
  ......
} else {
  ......
}
```

例如:

```js

if (target === toRaw(receiver)) {
    /* istanbul ignore else */
  if (__DEV__) {
    const extraInfo = { oldValue, newValue: value }
    if (!hadKey) {
      trigger(target, OperationTypes.ADD, key, extraInfo)
    } else if (value !== oldValue) {
      trigger(target, OperationTypes.SET, key, extraInfo)
    }
  } else {
    if (!hadKey) {
      trigger(target, OperationTypes.ADD, key)
    } else if (value !== oldValue) {
      trigger(target, OperationTypes.SET, key)
    }
  }
}
```

看到有个[pr](https://github.com/vuejs/vue-next/pull/90)想把它改成:

```js

if (target === toRaw(receiver) && (!hadKey || value !== oldValue)) {
    const operationType = !hadKey ? OperationTypes.ADD : OperationTypes.SET
    const extraInfo = __DEV__ ? { oldValue, newValue: value } : undefined
    trigger(target, operationType, key, extraInfo)
}

```
反正我一看没发现什么问题,可是却被closed,为啥嘞?
给出的原因是是第一种写法其实是故意写成那样可以更好的使用rollup在构建producion时的tree-shaking能力。
(This is intentionally written like this to utilise tree-shaking abilities of Rollup in production build)

我们来验证下,第一种方式下打包后看下字节数:

```
wc -c reactivity.global.prod.js

6067 reactivity.global.prod.js
```

第二种打包后:

```
wc -c reactivity.global.prod.js

7444 reactivity.global.prod.js
```

我擦嘞,确实减少了不少啊.

