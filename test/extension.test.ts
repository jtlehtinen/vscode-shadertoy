import { describe, expect, it } from 'vitest';
import { ShaderLexer, TokenType } from '../src/shaderlexer';
import { ShaderStream } from '../src/shaderstream';
import { ShaderParser, ObjectType } from '../src/shaderparser';

describe('Lexing Tests', () => {
  {
    const shaderContent = `\
/******************************************************************************
*   Multiline Comment
******************************************************************************/
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Output to screen
    fragColor = vec4(0.0, 0.0, 1.0, 1.0);
 }`;
    const stream = new ShaderStream(shaderContent);
    const lexer = new ShaderLexer(stream);

    it('Lex Whole Shader', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: 'void' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: 'mainImage' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: '(' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Keyword, value: 'out' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'vec4' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: 'fragColor' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: ',' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Keyword, value: 'in' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'vec2' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: 'fragCoord' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: ')' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: '{' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: 'fragColor' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Operator, value: '=' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'vec4' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: '(' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 0.0 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: ',' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 0.0 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: ',' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1.0 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: ',' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1.0 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: ')' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: ';' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Punctuation, value: '}' });
      expect(lexer.next()).toStrictEqual(undefined);
    });
  }

  {
    const typesContent = `\
int float vec2 /* a random comment */ ivec2 vec3 ivec3 vec4 ivec4
color3// an eof comment`;
    const stream = new ShaderStream(typesContent);
    const lexer = new ShaderLexer(stream);

    it('Lex Type', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'int' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'float' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'vec2' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'ivec2' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'vec3' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'ivec3' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'vec4' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'ivec4' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Type, value: 'color3' });
      expect(lexer.next()).toStrictEqual(undefined);
    });
  }

  {
    const stringsContents = `\
"a string" "a \\"string\\"" "a 'string'" /* a random comment */ /* back to back comments */ 'a string' 'a "string"' 'a \\'string\\''
/*
    a
    multiline
    comment
*/`;
    const stream = new ShaderStream(stringsContents);
    const lexer = new ShaderLexer(stream);

    it('Lex String', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.String, value: 'a string' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.String, value: 'a "string"' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.String, value: "a 'string'" });
      expect(lexer.next()).toStrictEqual({ type: TokenType.String, value: 'a string' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.String, value: 'a "string"' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.String, value: "a 'string'" });
      expect(lexer.next()).toStrictEqual(undefined);
    });
  }

  {
    const numbersContent = `\
1 999999999999999999999999999999999 1e6 1e-6 999999999999999.999999999999999999 1. .1 1.e6 1.e-6  .1e6 .1e-6
+1 +999999999999999999999999999999999 +1e6 +1e-6 +999999999999999.999999999999999999 +1. +.1 +1.e6 +1.e-6 +.1e6 +.1e-6
-1 -999999999999999999999999999999999 -1e6 -1e-6 -999999999999999.999999999999999999 -1. -.1 -1.e6 -1.e-6 -.1e6 -.1e-6 `;
    const stream = new ShaderStream(numbersContent);
    const lexer = new ShaderLexer(stream);

    it('Lex Integers', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Integer, value: 1 });
      expect(lexer.next()).toStrictEqual({
        type: TokenType.Integer,
        value: 999999999999999999999999999999999,
      }); // eslint-disable-line
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1e-6 });
    });

    it('Lex Floats', () => {
      expect(lexer.next()).toStrictEqual({
        type: TokenType.Float,
        value: 999999999999999.999999999999999999,
      }); // eslint-disable-line
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1. });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: .1 });
    });

    it('Lex Floats with Exponents', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1.e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1.e-6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: .1e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: .1e-6 });
    });

    it('Lex Integers with explicit Plus', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Integer, value: 1 });
      expect(lexer.next()).toStrictEqual({
        type: TokenType.Integer,
        value: 999999999999999999999999999999999,
      }); // eslint-disable-line
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1e-6 });
    });

    it('Lex Floats with explicit Plus', () => {
      expect(lexer.next()).toStrictEqual({
        type: TokenType.Float,
        value: 999999999999999.999999999999999999,
      }); // eslint-disable-line
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1. });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: .1 });
    });

    it('Lex Floats with explicit Plus with Exponents', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1.e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: 1.e-6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: .1e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: .1e-6 });
    });

    it('Lex negative Integers', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Integer, value: -1 });
      expect(lexer.next()).toStrictEqual({
        type: TokenType.Integer,
        value: -999999999999999999999999999999999,
      }); // eslint-disable-line
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -1e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -1e-6 });
    });

    it('Lex negative Floats', () => {
      expect(lexer.next()).toStrictEqual({
        type: TokenType.Float,
        value: -999999999999999.999999999999999999,
      }); // eslint-disable-line
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -1. });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -.1 });
    });

    it('Lex negative Floats with Exponents', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -1.e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -1.e-6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -.1e6 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Float, value: -.1e-6 });
      expect(lexer.next()).toStrictEqual(undefined);
    });
  }

  {
    const identifiersContent =
      'aFineVariable aFineVariable_1 a_fine_1_variable __a_fine_var__ 1_a_fine_var_';
    const stream = new ShaderStream(identifiersContent);
    const lexer = new ShaderLexer(stream);

    it('Lex Identifiers', () => {
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: 'aFineVariable' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: 'aFineVariable_1' });
      expect(lexer.next()).toStrictEqual({
        type: TokenType.Identifier,
        value: 'a_fine_1_variable',
      });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: '__a_fine_var__' });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Integer, value: 1 });
      expect(lexer.next()).toStrictEqual({ type: TokenType.Identifier, value: '_a_fine_var_' });
      expect(lexer.next()).toStrictEqual(undefined);
    });
  }
});

describe('Parsing Tests', () => {
  {
    const uniformsContents = `\
#iUniform float test_float = 1
#iUniform float test_float_with_range = 1 in { -1, 1 }
#iUniform vec4 test_vec4 = vec4(1, 1, 1, 1)
#iUniform vec4 test_vec4_with_range = vec4(1, 1, 1, 1) in { vec4(0, 1, 2, 3), vec4(99, 98, 97, 96) }
#iUniform vec4 test_vec4_with_mismatched_range = vec4(1, 1, 1, 1) in { 0, 99 }
#iUniform color3 test_color = color3(0.5, 0.5, 0.5)
`;
    const parser = new ShaderParser(uniformsContents);

    it('Parse Uniforms', () => {
      expect(parser.next()).toStrictEqual({
        Type: ObjectType.Uniform,
        Name: 'test_float',
        Typename: 'float',
        Default: [1.0],
        Min: undefined,
        Max: undefined,
        Step: undefined,
      });
      expect(parser.next()).toStrictEqual({
        Type: ObjectType.Uniform,
        Name: 'test_float_with_range',
        Typename: 'float',
        Default: [1.0],
        Min: [-1.0],
        Max: [1.0],
        Step: undefined,
      });
      expect(parser.next()).toStrictEqual({
        Type: ObjectType.Uniform,
        Name: 'test_vec4',
        Typename: 'vec4',
        Default: [1.0, 1.0, 1.0, 1.0],
        Min: undefined,
        Max: undefined,
        Step: undefined,
      });
      expect(parser.next()).toStrictEqual({
        Type: ObjectType.Uniform,
        Name: 'test_vec4_with_range',
        Typename: 'vec4',
        Default: [1.0, 1.0, 1.0, 1.0],
        Min: [0.0, 1.0, 2.0, 3.0],
        Max: [99.0, 98.0, 97.0, 96.0],
        Step: undefined,
      });
      expect(parser.next()).toStrictEqual({
        Type: ObjectType.Uniform,
        Name: 'test_vec4_with_mismatched_range',
        Typename: 'vec4',
        Default: [1.0, 1.0, 1.0, 1.0],
        Min: [0.0],
        Max: [99.0],
        Step: undefined,
      });
      expect(parser.next()).toStrictEqual({
        Type: ObjectType.Uniform,
        Name: 'test_color',
        Typename: 'color3',
        Default: [0.5, 0.5, 0.5],
        Min: undefined,
        Max: undefined,
        Step: undefined,
      });
      expect(parser.next()).toStrictEqual(undefined);
    });
  }

  {
    it('Assignability Tests', () => {
      const parser = new ShaderParser('');
      expect(parser['testAssignable']('int', 'int')).toStrictEqual(true);
      expect(parser['testAssignable']('float', 'int')).toStrictEqual(true);
      expect(parser['testAssignable']('float', 'float')).toStrictEqual(true);

      expect(parser['testAssignable']('int', 'float')).toStrictEqual(false);

      expect(parser['testAssignable']('int[]', 'int[]')).toStrictEqual(true);
      expect(parser['testAssignable']('int[]', 'int[3]')).toStrictEqual(true);
      expect(parser['testAssignable']('int[3]', 'int[3]')).toStrictEqual(true);
      expect(parser['testAssignable']('int[3][]', 'int[3][]')).toStrictEqual(true);
      expect(parser['testAssignable']('int[3][]', 'int[3][3]')).toStrictEqual(true);
      expect(parser['testAssignable']('int[3][3]', 'int[3][3]')).toStrictEqual(true);

      expect(parser['testAssignable']('float[3][3]', 'int[3][3]')).toStrictEqual(true);

      expect(parser['testAssignable']('int[2]', 'int[3]')).toStrictEqual(false);
      expect(parser['testAssignable']('int[2][2]', 'int[3][2]')).toStrictEqual(false);
      expect(parser['testAssignable']('int[][]', 'int[3][2]')).toStrictEqual(false);

      expect(parser['testAssignable']('int[]', 'int')).toStrictEqual(false);
      expect(parser['testAssignable']('int[]', 'float')).toStrictEqual(false);
      expect(parser['testAssignable']('float[]', 'float')).toStrictEqual(false);
      expect(parser['testAssignable']('float[]', 'int')).toStrictEqual(false);
    });
  }
});
