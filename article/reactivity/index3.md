# 浅析Vue3中的响应式原理

上回书说到（balabala...）

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