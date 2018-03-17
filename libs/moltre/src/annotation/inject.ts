import { UNDEFINED_INJECT_ANNOTATION } from '../constants/error-msgs';
import { MetadataKeys } from '../constants/metadata-keys';
import { ServiceIdentifier } from '../interfaces/interfaces';
import { Metadata } from '../planning/metadata';
import { tagParameter, tagProperty } from './decorator_utils';

export type ServiceIdentifierOrFunc = ServiceIdentifier<any> | LazyServiceIdentifier;

export class LazyServiceIdentifier<T = any> {
  private _cb: () => ServiceIdentifier<T>;

  public constructor(cb: () => ServiceIdentifier<T>) {
    this._cb = cb;
  }

  public unwrap(): ServiceIdentifier<T> {
    return this._cb();
  }
}

export function Inject(serviceIdentifier: ServiceIdentifierOrFunc) {
  return function (target: any, targetKey: string, index?: number): void {
    if (serviceIdentifier === undefined) {
      throw new Error(UNDEFINED_INJECT_ANNOTATION(target.name));
    }

    const metadata = new Metadata(MetadataKeys.INJECT_TAG, serviceIdentifier);

    if (typeof index === 'number') {
      tagParameter(target, targetKey, index, metadata);
    } else {
      tagProperty(target, targetKey, metadata);
    }

  };
}
