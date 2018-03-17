import { MetadataKeys } from '../constants/metadata-keys';
import { Metadata } from '../planning/metadata';
import { tagParameter, tagProperty } from './decorator_utils';

// Used to add named metadata which is used to resolve name-based contextual bindings.
export function Named(name: string | number | symbol) {
  return function (target: any, targetKey: string, index?: number) {
    const metadata = new Metadata(MetadataKeys.NAMED_TAG, name);
    if (typeof index === 'number') {
      tagParameter(target, targetKey, index, metadata);
    } else {
      tagProperty(target, targetKey, metadata);
    }
  };
}
