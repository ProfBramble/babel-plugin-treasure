import { join } from 'path';
import { addNamed, addDefault, addSideEffect } from '@babel/helper-module-imports';

function normalizeCustomName(originCustomName) {
  if (typeof originCustomName === 'string') {
    // eslint-disable-next-line import/no-dynamic-require
    const customeNameExports = require(originCustomName);
    return typeof customeNameExports === 'function'
      ? customeNameExports
      : customeNameExports.default;
  }
  return originCustomName;
}

export default class Plugin {
  constructor(
    libraryName,
    libraryDirectory,
    style,
    styleLibraryDirectory,
    customStyleName,
    camel2DashComponentName,
    camel2UnderlineComponentName,
    fileName,
    customName,
    transformToDefaultImport,
    types, // babel-types
    index = 0, // 标记符，具体作用后续补充
  ) {
    this.libraryName = libraryName; // 库名
    this.libraryDirectory = typeof libraryDirectory === 'undefined' ? 'lib' : libraryDirectory; // 包路径
    this.style = style || false; // 是否加载style
    this.styleLibraryDirectory = styleLibraryDirectory; // style包路径
    this.camel2DashComponentName = camel2DashComponentName; // 组件名转换为大 /小驼峰【upper/lower】
    this.transformToDefaultImport = transformToDefaultImport || true; // 处理默认导入，暂不知为何默认为true
    this.customName = normalizeCustomName(customName);
    this.customStyleName = normalizeCustomName(customStyleName);
    this.camel2UnderlineComponentName = camel2UnderlineComponentName; // 处理成类似time_picker的形式
    this.fileName = fileName || ''; // 链接到具体的文件，例如antd/lib/button/[abc.js]
    this.types = types; // babel-types
    this.pluginStateKey = `importPluginState${index}`;
  }

  getPluginState(state) {
    if (!state[this.pluginStateKey]) {
      // eslint-disable-next-line no-param-reassign
      state[this.pluginStateKey] = {}; // 初始化标示
    }
    return state[this.pluginStateKey]; // 返回标示
  }

  ProgramEnter(_, state) {
    const pluginState = this.getPluginState(state);
    pluginState.specified = Object.create(null); // 导入对象集合
    pluginState.libraryObjs = Object.create(null); // 库对象集合(非module导入的内容)
    pluginState.select = Object.create(null); // 具体未知
    pluginState.pathToRemove = []; // 存储需要删除的节点，在
    /**
     * state:{
     *    importPluginState「Number」: {
     *      specified:{},
     *      libraryObjs:{},
     *      select:{},
     *      pathToRemovw:[]
     *    },
     * }
     */
  }

  ProgramExit(_, state) {
    this.getPluginState(state).pathToRemove.forEach(p => !p.removed && p.remove());
    // 退出整一组AST时候删除节点，不清楚他如何管理所有待删除状态
  }

  ImportDeclaration(path, state) {
    const { node } = path;

    // path maybe removed by prev instances.都这样写，但待验证
    if (!node) return;

    const {
      source: { value },
    } = node;
    const { libraryName, types } = this;
    const pluginState = this.getPluginState(state);

    if (value === libraryName) {
      node.specifiers.forEach(spec => {
        if (types.isImportSpecifier(spec)) {
          pluginState.specified[spec.local.name] = spec.imported.name;
        } else {
          pluginState.libraryObjs[spec.local.name] = true;
        }
      });
      pluginState.pathsToRemove.push(path); // 取值完毕的节点添加进预删除数组
    }
  } // 主目标，收集依赖

  ClassDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['superClass'], path, state); // 不明白为啥叫superClass
  }

  ReturnStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['argument'], path, state); // 取return AST 结构的argument
  }

  ConditionalExpression(path, state) {
    // 取三元表达式的条件与结果
    const { node } = path;
    this.buildExpressionHandler(node, ['test', 'consequent', 'alternate'], path, state);
  }
  // MemberExpression(path, state) {
  //   const { node } = path;
  // }
  CallExpression(path, state) {
    const { node } = path;
    const file = path?.hub?.file || state?.file;
    const { name } = node.callee;
    const { types } = this;
    const pluginState = this.getPluginState(state);
    if (types.isIdentifier(node.callee)) {
      // 这里对应场景不明
    }
    node.arguments = node.arguments.map(arg => {
      const { name: argName } = arg;
      if (
        pluginState.specified[argName] &&
        path.scope.hasBinding(argName) &&
        type.isImportSpecifier(path.scope.getBinding(argName).path)
      ) {
        return this.importMethod(pluginState.specified[argName], file, pluginState); // 替换了引用，help/import插件返回节点类型与名称
      }
      return arg;
    });
  }

  buildExpressionHandler(node, props, path, state) {
    const file = path?.hub?.file || state?.file; // 具体原因待补充，和help/import有关
    const { types } = this;
    const pluginState = this.getPluginState(state);
    props.forEach(prop => {
      if (!types.isIdentifier(node[prop])) return; // 不是Identifier就结束
      if (
        pluginState.specified[node[prop].name] && // node[prop].name别名，看看用了没，如果用了
        types.isImportSpecifier(path.node.getBinding(node[prop].name).path) //根据作用域回溯，看看是不是一个import节点
      ) {
        //替换AST节点
      }
    });
  }
}
