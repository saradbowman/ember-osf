import { moduleForModel, test } from 'ember-qunit';

moduleForModel('wiki', 'Unit | Serializer | wiki', {
  // Specify the other units that are required for this test.
  needs: ['serializer:wiki', 'model:node']
});

// Replace this with your real tests.
test('it serializes records', function(assert) {
  let record = this.subject();

  let serializedRecord = record.serialize();

  assert.ok(serializedRecord);
});
