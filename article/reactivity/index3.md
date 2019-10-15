# 浅析Vue3中的响应式原理

上回书说到（balabala...）

## __dev__

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

反正我一看没发现什么问题,可是却被拒绝了,为啥嘞?
给出的原因是第一种写法其实是故意写成那样的,因为可以更好的使用rollup在构建producion时的tree-shaking能力。
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

## TS


### UnwrapRef

个人觉得最复杂的就是这里了:

```ts

// 泛型不结合函数会不太好理解,这里把函数也粘过来

export interface Ref<T = any> {
  [refSymbol]: true
  value: UnwrapRef<T>
}

type BailTypes =
  | Function
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>

export type UnwrapRef<T> = {
  cRef: T extends ComputedRef<infer V> ? UnwrapRef<V> : T
  ref: T extends Ref<infer V> ? UnwrapRef<V> : T
  array: T extends Array<infer V> ? Array<UnwrapRef<V>> : T
  object: { [K in keyof T]: UnwrapRef<T[K]> }
  stop: T
}[T extends ComputedRef<any>     //这里是在判断ref<T>函数中传入的T数据是什么类型
  ? 'cRef'                       // T extends U ? X : Y : 若T能够赋值给U，那么类型是X，否则为Y
  : T extends Ref
    ? 'ref'
    : T extends Array<any>
      ? 'array'
      : T extends BailTypes
        ? 'stop' // bail out on types that shouldn't be unwrapped
        : T extends object ? 'object' : 'stop']  // 在判断出T的类型后就取出那个类型
// 假如T是array,那么 UnwrapRef<T> = T extends Array<infer V> ? Array<UnwrapRef<V>> : T
// infer会引入一个待推断的类型变量
// 举个例子
type T0 = UnwrapRef<Array<number>> 
// Array<UnwrapRef<number>> ----> Array<number> = number[]

interface IProp {
  a:number,
  b:string
}
type T1 = UnwrapRef<Array<IProp>>
// {
//     a: number;
//     b: string;
// }[]

```
### Record<any, any>

```ts
export const isObject = (val: any): val is Record<any, any> =>
  val !== null && typeof val === 'object'

// Record<any, any> Vs Object 

let a: Record<any, any> = {};
a.foo;  // works

let b: object = {};
b.foo;  // // Property 'foo' does not exist on type 'object'.

```
