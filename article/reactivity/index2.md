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

#### 可以停止的computed

上面的实现好像没什么问题哦？但是(此处应配可达鸭眉头一皱,发现事情并不简单,但是我懒得配。。。)
看一下这个测试用例:
```ts
it('should no longer update when stopped', () => {
  const value = reactive<{ foo?: number }>({})
  const cValue = computed(() => value.foo)
  let dummy
  effect(() => {
    dummy = cValue.value
  })
  expect(dummy).toBe(undefined)
  value.foo = 1
  expect(dummy).toBe(1)
  stop(cValue.effect)
  value.foo = 2
  expect(dummy).toBe(1)
})
```
可以看出在`stop(cValue.effect)`之后,`cValue.value`便不会随着`value.foo`而改变了

### trackChildRun

此外,当在effect中使用(get)computed的值时,effect中的ReactiveEffect会获取其中的所有computed的依赖(dep)并将他们挂载到自身的属性上。(具体这么做的原因暂时我还没有发现,因为现在的dep都是从targetMap中获取执行的,应该是在其他包中使用到了,所以在ReactiveEffect自身属性上也挂载了一份)。
```js
let a = reactive({ b: 2,c:3 })
let b = computed(() => {
    return a.b
})
let c = computed(() => {
    return a.c
})
let dummy
debugger
const cc = effect(() => {
    dummy = b.value+c.value
})
debugger
```
可以debug看一下上面的代码,就会发现`cc.deps`就是一个由`b.deps`和`c.deps`组成的数组。
其实看源码会发现computed就是一个特殊的ReactiveEffect。

### 被代理的value

看下面这个例子:
```js
let a = reactive({ b: 2 })
let b = computed(() => {
    return a.b
})
let dummy;
const c = effect(()=>{
    dummy = b.value
})
console.log(dummy) // 2
a.b = 0
console.log(dummy) // 0
```
按照之前所知道的内容c中的ReactiveEffect执行,应当是b.value改变了,如果b是一个普通reactive对象的话,应该会有一个`b.value = 0`的操作。而computed对象,我们这里是改变了`a.b = 0`,那这是怎么实现的呢？
我们看下面的代码:
```js
function computed(
  getter
): any {
  let dirty = true
  let value
  const runner = effect(getter, {
    lazy: true,
    computed: true,
  })
  return {
    // expose effect so computed can be stopped
    effect: runner,
    get value() {
      value = runner()
      return value
    },
    
  }
}
```
配合这个例子我们来说明一下:
```js
let o = reactive({a:1})
const f1 = ()=>{
    console.log(o.a)
}
const e1 =  effect(f1)
const f2 = ()=> o.a
let b = computed(f2)
const f3 = ()=>{
    console.log(b.value)
}
const e2 = effect(f3)
```
我们知道f1会在传入effect时被执行一次,而f2会在或取b.value时才会执行。
而在获取b.value时,会执行上面源码中的runner,runner的内容即是f2,而f2中获取了o.a,此时activeReactiveEffectStack中的ReactiveEffect是e2
所以e2便会被存入o.a的Dep Set中。
这样在o.a被set时,e2就会被执行即执行f3.


### computed ReactiveEffect执行时机

此外在源码中有这么一段[代码](https://github.com/vuejs/vue-next/blob/master/packages/reactivity/src/effect.ts#L192):
```js
// Important: computed effects must be run first so that computed getters
// can be invalidated before any normal effects that depend on them are run.
computedRunners.forEach(run)
effects.forEach(run)
```
意思是说在set值时要确保computed相关的ReactiveEffect要先执行,否则就会使依赖这些computed的effects失效。
来看个具体的例子来感受下吧:
```js
let a = reactive({ b: 2 })
let b = computed(() => {
    return a.b
})
let dummy;
const c = effect(()=>{
    dummy = b.value
})
console.log(dummy) // 2
a.b = 0
console.log(dummy) // 0
console.log(b.value) // 0
```
而当我们将Vue3的代码改为
```js
effects.forEach(run)
computedRunners.forEach(run)
```
上段代码的执行结果就会变为
```js
2
2
0
```
这自然就是因为没有先执行更新computed中的ReactiveEffect,而先执行`()=>{dummy = b.value}`,虽然b的值改变了dummy值依然没有改变。

## 总结

到此我们应该算是对ref与computed的原理有所了解了,结合上篇文章的话那么对于@vue/reactivity的核心实现与使用也应该有个直观的了解了。
下篇文章计划写一些@vue/reactivity的其他细节,比如ts类型啊这类的。

