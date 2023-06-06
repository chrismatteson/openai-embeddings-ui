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
        ],
    },
    externalsType: 'global',
    externals: {
        "fetch": "fetch",
        "fsPromises": "fsPromises",
        "glob": "glob",
        "crypto": "crypto",
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            // polyfills for nodejs modules
            "url": require.resolve("url/"),
            "util": require.resolve("util/"),
            "buffer": require.resolve("buffer/"),
            "path": require.resolve("path-browserify"),
            "stream": require.resolve("stream-browserify"),
            "https": require.resolve("https-browserify"),
            "http": require.resolve("stream-http"),
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
