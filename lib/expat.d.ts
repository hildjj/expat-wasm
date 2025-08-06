// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
    /**
     * @param {string=} returnType
     * @param {Array=} argTypes
     * @param {Object=} opts
     */
    function cwrap(ident: any, returnType?: string | undefined, argTypes?: any[] | undefined, opts?: any | undefined): (...args: any[]) => any;
    /**
     * @param {string|null=} returnType
     * @param {Array=} argTypes
     * @param {Array=} args
     * @param {Object=} opts
     */
    function ccall(ident: any, returnType?: (string | null) | undefined, argTypes?: any[] | undefined, args?: any[] | undefined, opts?: any | undefined): any;
    /** @param {string=} sig */
    function addFunction(func: any, sig?: string | undefined): any;
    function removeFunction(index: any): void;
    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index.
     * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
     * @return {string}
     */
    function UTF8ToString(ptr: number, maxBytesToRead?: number | undefined, ignoreNul?: boolean | undefined): string;
    let HEAPU32: any;
}
interface WasmModule {
  _XML_ParserCreate(_0: number): number;
  _XML_ParserCreateNS(_0: number, _1: number): number;
  _XML_ParserFree(_0: number): void;
  _XML_ParserReset(_0: number, _1: number): number;
  _XML_ExternalEntityParserCreate(_0: number, _1: number, _2: number): number;
  _XML_SetReturnNSTriplet(_0: number, _1: number): void;
  _XML_SetUserData(_0: number, _1: number): void;
  _XML_SetBase(_0: number, _1: number): number;
  _XML_GetBase(_0: number): number;
  _XML_SetStartElementHandler(_0: number, _1: number): void;
  _XML_SetEndElementHandler(_0: number, _1: number): void;
  _XML_SetCharacterDataHandler(_0: number, _1: number): void;
  _XML_SetProcessingInstructionHandler(_0: number, _1: number): void;
  _XML_SetCommentHandler(_0: number, _1: number): void;
  _XML_SetStartCdataSectionHandler(_0: number, _1: number): void;
  _XML_SetEndCdataSectionHandler(_0: number, _1: number): void;
  _XML_SetDefaultHandler(_0: number, _1: number): void;
  _XML_SetDefaultHandlerExpand(_0: number, _1: number): void;
  _XML_SetStartDoctypeDeclHandler(_0: number, _1: number): void;
  _XML_SetEndDoctypeDeclHandler(_0: number, _1: number): void;
  _XML_SetNotationDeclHandler(_0: number, _1: number): void;
  _XML_SetStartNamespaceDeclHandler(_0: number, _1: number): void;
  _XML_SetEndNamespaceDeclHandler(_0: number, _1: number): void;
  _XML_SetExternalEntityRefHandler(_0: number, _1: number): void;
  _XML_SetSkippedEntityHandler(_0: number, _1: number): void;
  _XML_SetElementDeclHandler(_0: number, _1: number): void;
  _XML_SetAttlistDeclHandler(_0: number, _1: number): void;
  _XML_SetEntityDeclHandler(_0: number, _1: number): void;
  _XML_SetXmlDeclHandler(_0: number, _1: number): void;
  _XML_SetParamEntityParsing(_0: number, _1: number): number;
  _XML_Parse(_0: number, _1: number, _2: number, _3: number): number;
  _XML_StopParser(_0: number, _1: number): number;
  _XML_GetErrorCode(_0: number): number;
  _XML_GetCurrentByteIndex(_0: number): number;
  _XML_GetCurrentLineNumber(_0: number): number;
  _XML_GetCurrentColumnNumber(_0: number): number;
  _XML_FreeContentModel(_0: number, _1: number): void;
  _XML_ErrorString(_0: number): number;
  _XML_ExpatVersion(): number;
}

export type MainModule = WasmModule & typeof RuntimeExports;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
