// Core API ------------------------------------------------------------------

export const version = __VERSION__
export {
  // core
  reactive,
  ref,
  readonly,
  // utilities
  unref,
  isRef,
  toRef,
  toRefs,
  isProxy,
  isReactive,
  isReadonly,
  // advanced
  customRef,
  triggerRef,
  shallowRef,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw
} from '@vue/reactivity'
export { computed } from './apiComputed'
export { watch, watchEffect } from './apiWatch'
export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onRenderTracked,
  onRenderTriggered,
  onErrorCaptured
} from './apiLifecycle'
export { provide, inject } from './apiInject'
export { nextTick } from './scheduler'
export { defineComponent } from './apiDefineComponent'
export { defineAsyncComponent } from './apiAsyncComponent'

// Advanced API ----------------------------------------------------------------

// For getting a hold of the internal instance in setup() - useful for advanced
// plugins
export { getCurrentInstance } from './component'

// For raw render function users
export { h } from './h'
// Advanced render function utilities
export { createVNode, cloneVNode, mergeProps, isVNode } from './vnode'
// VNode types
export { Fragment, Text, Comment, Static } from './vnode'
// Built-in components
export { Teleport, TeleportProps } from './components/Teleport'
export { Suspense, SuspenseProps } from './components/Suspense'
export { KeepAlive, KeepAliveProps } from './components/KeepAlive'
export {
  BaseTransition,
  BaseTransitionProps
} from './components/BaseTransition'
// For using custom directives
export { withDirectives } from './directives'
// SFC CSS Modules
export { useCSSModule } from './helpers/useCssModule'
// SSR context
export { useSSRContext, ssrContextKey } from './helpers/useSsrContext'

// Custom Renderer API ---------------------------------------------------------

export { createRenderer, createHydrationRenderer } from './renderer'
export { queuePostFlushCb } from './scheduler'
export { warn } from './warning'
export {
  handleError,
  callWithErrorHandling,
  callWithAsyncErrorHandling,
  ErrorCodes
} from './errorHandling'
export {
  resolveComponent,
  resolveDirective,
  resolveDynamicComponent
} from './helpers/resolveAssets'
// For integration with runtime compiler
export { registerRuntimeCompiler } from './component'
export {
  useTransitionState,
  resolveTransitionHooks,
  setTransitionHooks
} from './components/BaseTransition'

// Types -----------------------------------------------------------------------

import { VNode } from './vnode'
import { ComponentInternalInstance } from './component'

// Augment Ref unwrap bail types.
// Note: if updating this, also update `types/refBail.d.ts`.
declare module '@vue/reactivity' {
  export interface RefUnwrapBailTypes {
    runtimeCoreBailTypes:
      | VNode
      | {
          // directly bailing on ComponentPublicInstance results in recursion
          // so we use this as a bail hint
          $: ComponentInternalInstance
        }
  }
}

export {
  ReactiveEffect,
  ReactiveEffectOptions,
  DebuggerEvent,
  TrackOpTypes,
  TriggerOpTypes,
  Ref,
  ComputedRef,
  UnwrapRef,
  WritableComputedOptions,
  ToRefs
} from '@vue/reactivity'
export {
  // types
  WatchEffect,
  WatchOptions,
  WatchOptionsBase,
  WatchCallback,
  WatchSource,
  WatchStopHandle
} from './apiWatch'
export { InjectionKey } from './apiInject'
export {
  App,
  AppConfig,
  AppContext,
  Plugin,
  CreateAppFunction,
  OptionMergeFunction
} from './apiCreateApp'
export {
  VNode,
  VNodeChild,
  VNodeTypes,
  VNodeProps,
  VNodeArrayChildren,
  VNodeNormalizedChildren
} from './vnode'
export {
  Component,
  FunctionalComponent,
  ComponentInternalInstance,
  SetupContext
} from './component'
export {
  ComponentOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsWithArrayProps,
  ComponentCustomOptions,
  ComponentOptionsBase,
  RenderFunction
} from './componentOptions'
export {
  ComponentPublicInstance,
  ComponentCustomProperties
} from './componentProxy'
export {
  Renderer,
  RendererNode,
  RendererElement,
  HydrationRenderer,
  RendererOptions,
  RootRenderFunction
} from './renderer'
export { RootHydrateFunction } from './hydration'
export { Slot, Slots } from './componentSlots'
export {
  Prop,
  PropType,
  ComponentPropsOptions,
  ComponentObjectPropsOptions,
  ExtractPropTypes
} from './componentProps'
export {
  Directive,
  DirectiveBinding,
  DirectiveHook,
  ObjectDirective,
  FunctionDirective,
  DirectiveArguments
} from './directives'
export { SuspenseBoundary } from './components/Suspense'
export { TransitionState, TransitionHooks } from './components/BaseTransition'
export {
  AsyncComponentOptions,
  AsyncComponentLoader
} from './apiAsyncComponent'
export { HMRRuntime } from './hmr'

// Internal API ----------------------------------------------------------------

// **IMPORTANT** Internal APIs may change without notice between versions and
// user code should avoid relying on them.

// For compiler generated code
// should sync with '@vue/compiler-core/src/runtimeConstants.ts'
export { withCtx } from './helpers/withRenderContext'
export { renderList } from './helpers/renderList'
export { toHandlers } from './helpers/toHandlers'
export { renderSlot } from './helpers/renderSlot'
export { createSlots } from './helpers/createSlots'
export { pushScopeId, popScopeId, withScopeId } from './helpers/scopeId'
export {
  openBlock,
  createBlock,
  setBlockTracking,
  createTextVNode,
  createCommentVNode,
  createStaticVNode
} from './vnode'

// a bit of ceremony to mark these internal only here because we need to include
// them in @vue/shared's typings
import { toDisplayString, camelize } from '@vue/shared'
/**
 * @internal
 */
const _toDisplayString = toDisplayString
/**
 * @internal
 */
const _camelize = camelize
export { _toDisplayString as toDisplayString, _camelize as camelize }

// For test-utils
export { transformVNodeArgs } from './vnode'

// SSR -------------------------------------------------------------------------

// **IMPORTANT** These APIs are exposed solely for @vue/server-renderer and may
// change without notice between versions. User code should never rely on them.

import { createComponentInstance, setupComponent } from './component'
import {
  renderComponentRoot,
  setCurrentRenderingInstance
} from './componentRenderUtils'
import { isVNode, normalizeVNode } from './vnode'
import { normalizeSuspenseChildren } from './components/Suspense'

const _ssrUtils = {
  createComponentInstance,
  setupComponent,
  renderComponentRoot,
  setCurrentRenderingInstance,
  isVNode,
  normalizeVNode,
  normalizeSuspenseChildren
}

/**
 * SSR utils for \@vue/server-renderer. Only exposed in cjs builds.
 * @internal
 */
export const ssrUtils = (__NODE_JS__ ? _ssrUtils : null) as typeof _ssrUtils
