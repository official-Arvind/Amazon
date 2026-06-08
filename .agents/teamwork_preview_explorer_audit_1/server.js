const express = require('express');

const rootPath = 'd:\\Desktop\\Website\\Amazon';
const port = 8080;

const app = express();
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.url}`);
    next();
});
app.use(express.static(rootPath));
app.use((req, res, next) => {
    console.error(`[404] Not Found: ${req.url}`);
    res.status(404).send('Not found');
});

const server = app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
