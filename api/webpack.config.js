const path = require('path');

module.exports = {
    entry: './src/index.ts',
    target: 'es6',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.node$/,
                loader: 'node-loader',
              },
        ],
    },
    externalsType: 'global',
    externals: {
        "fetch": "fetch",
        "fsPromises": "fsPromises",
        "glob": "glob",
        "crypto": "crypto",
        "nodeExternals": "nodeExternals"
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            // polyfills for nodejs modules
            "url": require.resolve("url/"),
            "http": require.resolve("stream-http"),
            "stream": require.resolve("stream-browserify"),
            "path": require.resolve("path-browserify"),
            "https": require.resolve("https-browserify"),
            "util": require.resolve("util/"),
            // no polyfill for these
            "fs": false,
        },
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'spin.js',
        chunkFormat: 'module',
        chunkLoading: 'import',
        library: {
            type: 'this',
            name: 'spin',
        },
    },
    optimization: {
        minimize: false
    },
};
