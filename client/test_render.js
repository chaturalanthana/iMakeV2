require('@babel/register')({ presets: ['@babel/preset-env', '@babel/preset-react'] });
const React = require('react');
const ReactDOMServer = require('react-dom/server');

const LiveSearchDropdown = require('./src/components/ui/LiveSearchDropdown').default;

try {
    const html = ReactDOMServer.renderToString(
        React.createElement(LiveSearchDropdown, {
            options: [{label: 'A', value: 'A'}],
            value: 'A',
            onChange: () => {}
        })
    );
    console.log("RENDER SUCCESS!");
} catch (err) {
    console.error("RENDER CRASHED:", err);
}
