'use strict'

const path = require('path')
const webpack = require('webpack')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

const resolve = dir => path.join(__dirname, '.', dir)

const isProd = process.env.NODE_ENV === 'production'

module.exports = {
  entry: {
    stm32dfu: './src/index.js'
  },
  output: {
    path: resolve('dist'), // 输出目录
    filename: '[name].js', // 输出文件
    libraryTarget: 'umd', // 采用通用模块定义
    library: 'stm32dfu', // 库名称
    libraryExport: 'default', // 兼容 ES6(ES2015) 的模块系统、CommonJS 和 AMD 模块规范
    globalObject: 'this' // 兼容node和浏览器运行，避免window is not undefined情况
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: ["@babel/preset-env"],
        },
        include: [resolve('src')]
      }
    ]
  },
  plugins: isProd
    ? [
      new UglifyJsPlugin({
        parallel: true,
        uglifyOptions: {
          compress: {
            warnings: false
          },
          mangle: true
        },
        sourceMap: true
      })
    ]
    : []
}