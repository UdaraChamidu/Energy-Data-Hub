const fs = require('fs');
const path = require('path');

const workflowPath = path.resolve(
  __dirname,
  '..',
  'workflows',
  '01_grid_frequency_netzfrequenzmessung_de.json',
);
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const parser = workflow.nodes.find((node) => node.name === 'Parse Frequency XML');
if (!parser) throw new Error('Parse Frequency XML node was not found.');

const oldValidation = `if (!Number.isFinite(actualHz)) {
  throw new Error(\`Invalid frequency value: \${frequencyMatch[1]}\`);
}`;
const newValidation = `if (!Number.isFinite(actualHz) || actualHz < 45 || actualHz > 55) {
  throw new Error(\`Implausible frequency value rejected: \${frequencyMatch[1]} Hz\`);
}`;

if (parser.parameters.jsCode.includes(oldValidation)) {
  parser.parameters.jsCode = parser.parameters.jsCode.replace(oldValidation, newValidation);
} else if (!parser.parameters.jsCode.includes(newValidation)) {
  throw new Error('Expected frequency validation block was not found.');
}

fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log('Applied 45-55 Hz validation to workflow 01.');
