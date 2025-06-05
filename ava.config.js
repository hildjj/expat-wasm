const files = [
  'test/!(using).ava.js',
];

// `using` is only supported in node 24+
const m = process.version.match(/^v(?<major>\d+)/);
if (m && (parseInt(m.groups.major, 10) >= 24)) {
  files.push('test/using.ava.js');
}

export default {
  files,
};
