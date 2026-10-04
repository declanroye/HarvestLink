import {CreateWebWorkerMLCEngine,prebuiltAppConfig,hasModelInCache} from '@mlc-ai/web-llm';
export {CreateWebWorkerMLCEngine,hasModelInCache};
export const modelId='Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
export const appConfig={model_list:prebuiltAppConfig.model_list.filter(m=>m.model_id===modelId),cacheBackend:'cache'};
