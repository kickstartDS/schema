import { applyLensToDoc } from './doc.js';
import githubIssues from './github-issues-with-nulls.json';
import { LensSource } from './lens-ops.js';

// Real API data has null inside arrays of objects (GitHub issues: milestone, assignee,
// labels[].archived_at). Inferring the document's schema used to throw on it.
const rename: LensSource = [{ op: 'rename', source: 'items', destination: 'entries' }];
const mapTitle: LensSource = [
  {
    op: 'in',
    name: 'issues',
    lens: [{ op: 'map', lens: [{ op: 'rename', source: 'title', destination: 'name' }] }]
  }
];

describe('documents with null inside arrays of objects', () => {
  it('converts an object in one item and null in another', () => {
    expect(applyLensToDoc(rename, { items: [{ o: { x: 1 } }, { o: null }] })).toEqual({
      entries: [{ o: { x: 1 } }, { o: null }]
    });
  });

  it('converts null items in an array', () => {
    expect(applyLensToDoc(rename, { items: [null, { a: 1 }] })).toEqual({ entries: [null, { a: 1 }] });
  });

  it('maps over real GitHub issues', () => {
    const output = applyLensToDoc(mapTitle, { issues: githubIssues }) as {
      issues: { name: string; milestone: unknown }[];
    };
    expect(output.issues.map((issue) => issue.name)).toEqual(githubIssues.map((issue) => issue.title));
    expect(output.issues[0].milestone).toBeNull();
  });
});
