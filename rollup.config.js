import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const extensions = ['.js'];

export default [
    {
        input: 'src/index.js',
        output: {
            file: pkg.module,
            format: 'esm',
            sourcemap: true,
        },
        plugins: [
            resolve({ extensions }),
            commonjs(),
            babel({ 
                babelHelpers: 'bundled', 
                extensions,
                exclude: 'node_modules/**' 
            }),
        ],
    },
    {
        input: 'src/index.js',
        output: {
            file: pkg.main,
            format: 'umd',
            name: 'ProctorSDK',
            sourcemap: true,
            globals: {}
        },
        plugins: [
            resolve({ extensions }),
            commonjs(),
            babel({ 
                babelHelpers: 'bundled', 
                extensions,
                exclude: 'node_modules/**'
            }),
            terser(),
        ],
    },
];