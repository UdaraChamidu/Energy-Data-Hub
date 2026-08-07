const request = $('Build EPEX Complete Requests').item.json;
const response = $json.data ?? $json.body ?? $json;

return [{
  json: {
    ...request,
    data: typeof response === 'string' ? response : JSON.stringify(response),
  },
}];
