'use strict';

import * as Types from '../../typenames';
import { WebviewExtension } from '../webview_extension';

export class UniformsPreambleExtension implements WebviewExtension {
  private content: string;

  constructor(buffers: Types.BufferDefinition[]) {
    this.content = '';
    this.processBuffers(buffers);
  }

  private static mapTypenameToGlslType(typename: string) {
    if (typename === 'color3') {
      return 'vec3';
    } else {
      return typename;
    }
  }

  private processBuffers(buffers: Types.BufferDefinition[]) {
    for (let buffer of buffers) {
      let uniforms = buffer.CustomUniforms;
      for (let uniform of uniforms) {
        this.content += `\
uniform ${UniformsPreambleExtension.mapTypenameToGlslType(uniform.Typename)} ${uniform.Name};
`;
      }
    }
  }

  public generateContent(): string {
    return this.content;
  }
}
