'use strict';

const JSONStream = require('json-stream');
const Promise = require('bluebird');
const proxyquire = require('proxyquire');
const config = require('../../common/config');
const CONST = require('../../common/constants');
const catalog = require('../../common/models/catalog');
const eventmesh = require('../../data-access-layer/eventmesh/ApiServerClient');

const backup_guid = '071acb05-66a3-471b-af3c-8bbf1e4180bc';
const plan_id = 'bc158c9a-7934-401e-94ab-057082a5073f';
const instance_id = 'b4719e7c-e8d3-4f7f-c515-769ad1c3ebfa';
const DefaultBackupManagerDummy = {
  registerWatcherDummy: () => {},
  createServiceDummy: () => {},
  startBackupDummy: () => {},
  abortBackupDummy: () => {},
  deleteBackupDummy: () => {},
  getOperationOptionsDummy: () => {},
};
const resultOptions = {
  plan_id: plan_id
};
const DefaultBackupManager = proxyquire('../../managers/backup-manager/DefaultBackupManager', {
  '../../data-access-layer/eventmesh': {
    'apiServerClient': {
      'getOperationOptions': function (opts) {
        DefaultBackupManagerDummy.getOperationOptionsDummy(opts);
        return Promise.resolve(resultOptions);
      }
    }
  },
  './': {
    'createService': function (plan) {
      DefaultBackupManagerDummy.createServiceDummy(plan);
      return Promise.resolve({
        'startBackup': (opts) => {
          DefaultBackupManagerDummy.startBackupDummy(opts);
          return Promise.resolve({});
        },
        'abortLastBackup': (opts) => {
          DefaultBackupManagerDummy.abortBackupDummy(opts);
          return Promise.resolve({});
        },
        'deleteBackup': (opts) => {
          DefaultBackupManagerDummy.deleteBackupDummy(opts);
          return Promise.resolve({});
        },
      });
    }
  }
});

function initDefaultBMTest(jsonStream, sandbox, registerWatcherStub) {
  const registerWatcherFake = function (resourceGroup, resourceType, callback) {
    return Promise.try(() => {
      jsonStream.on('data', callback);
      return jsonStream;
    });
  };
  registerWatcherStub = sandbox.stub(eventmesh.prototype, 'registerWatcher', registerWatcherFake);
  /* jshint unused:false */
  const bm = new DefaultBackupManager();
  bm.init();
  expect(registerWatcherStub.callCount).to.equal(1);
  expect(registerWatcherStub.firstCall.args[0]).to.eql(CONST.APISERVER.RESOURCE_GROUPS.BACKUP);
  expect(registerWatcherStub.firstCall.args[1]).to.eql(CONST.APISERVER.RESOURCE_TYPES.DEFAULT_BACKUP);
  expect(registerWatcherStub.firstCall.args[2].name).to.eql('bound handleResource');
  expect(registerWatcherStub.firstCall.args[3]).to.eql('state in (in_queue,abort,delete)');
  registerWatcherStub.restore();
}

describe('managers', function () {
  describe('DefaultBackupManager', function () {
    let createServiceSpy, startBackupSpy, abortBackupSpy, deleteBackupSpy, getOperationOptionsSpy, registerWatcherStub, sandbox;
    before(function () {
      sandbox = sinon.sandbox.create();
      createServiceSpy = sinon.spy(DefaultBackupManagerDummy, 'createServiceDummy');
      startBackupSpy = sinon.spy(DefaultBackupManagerDummy, 'startBackupDummy');
      abortBackupSpy = sinon.spy(DefaultBackupManagerDummy, 'abortBackupDummy');
      deleteBackupSpy = sinon.spy(DefaultBackupManagerDummy, 'deleteBackupDummy');
      getOperationOptionsSpy = sinon.spy(DefaultBackupManagerDummy, 'getOperationOptionsDummy');
    });

    afterEach(function () {
      createServiceSpy.reset();
      startBackupSpy.reset();
      abortBackupSpy.reset();
      deleteBackupSpy.reset();
    });

    it('Should process startBackup request successfully', () => {
      const options = {
        guid: backup_guid,
        plan_id: plan_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'in_queue'
          }
        }
      };
      mocks.apiServerEventMesh.nockPatchResourceRegex('backup', 'defaultbackup', {
        metadata: {
          annotations: config.broker_ip
        }
      }, 2);
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.firstCall.args[0]).to.eql(catalog.getPlan(plan_id));
          expect(startBackupSpy.callCount).to.equal(1);
          expect(startBackupSpy.firstCall.args[0]).to.eql(options);
          mocks.verify();
        });
    });

    it('Should process abortBackup request successfully', () => {
      const options = {
        guid: backup_guid,
        instance_guid: instance_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'abort'
          }
        }
      };
      mocks.apiServerEventMesh.nockPatchResourceRegex('backup', 'defaultbackup', {
        metadata: {
          annotations: config.broker_ip
        }
      }, 2);
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.callCount).to.equal(1);
          expect(createServiceSpy.firstCall.args[0]).to.eql(catalog.getPlan(plan_id));
          expect(abortBackupSpy.callCount).to.equal(1);
          expect(abortBackupSpy.firstCall.args[0]).to.eql(resultOptions);
          mocks.verify();
        });
    });

    it('Should process deleteBackup request successfully', () => {
      const options = {
        guid: backup_guid,
        instance_guid: instance_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'delete'
          }
        }
      };
      mocks.apiServerEventMesh.nockPatchResourceRegex('backup', 'defaultbackup', {
        metadata: {
          annotations: config.broker_ip
        }
      }, 2);
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.callCount).to.equal(1);
          expect(createServiceSpy.firstCall.args[0]).to.eql(catalog.getPlan(plan_id));
          expect(deleteBackupSpy.callCount).to.equal(1);
          expect(deleteBackupSpy.firstCall.args[0]).to.eql(resultOptions);
          mocks.verify();
        });
    });

    it('Should not process request if already being served', () => {
      const options = {
        guid: backup_guid,
        instance_guid: instance_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`,
            annotations: {
              lockedByManager: config.broker_ip
            }
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'in_queue'
          }
        }
      };
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.callCount).to.equal(0);
          expect(startBackupSpy.callCount).to.equal(0);
          mocks.verify();
        });
    });

    it('Should not process request if processing lock is not acquired', () => {
      const options = {
        guid: backup_guid,
        instance_guid: instance_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'in_queue'
          }
        }
      };
      mocks.apiServerEventMesh.nockPatchResourceRegex('backup', 'defaultbackup', {
        metadata: {
          annotations: ''
        }
      }, 1, undefined, 409);
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.callCount).to.equal(0);
          expect(startBackupSpy.callCount).to.equal(0);
          mocks.verify();
        });
    });

    it('Should handle acquire processing lock error gracefully', () => {
      const options = {
        guid: backup_guid,
        instance_guid: instance_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'in_queue'
          }
        }
      };
      mocks.apiServerEventMesh.nockPatchResourceRegex('backup', 'defaultbackup', {
        metadata: {
          annotations: ''
        }
      }, 1, undefined, 404);
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.callCount).to.equal(0);
          expect(startBackupSpy.callCount).to.equal(0);
          mocks.verify();
        });
    });

    it('Should not process request if already picked by other process', () => {
      const options = {
        guid: backup_guid,
        instance_guid: instance_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`,
            annotations: {
              lockedByManager: '10.11.12.13'
            }
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'in_queue'
          }
        }
      };
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.callCount).to.equal(0);
          expect(startBackupSpy.callCount).to.equal(0);
          mocks.verify();
        });
    });

    it('Should gracefully handle errors occured while releasing processing lock', () => {
      const options = {
        guid: backup_guid,
        plan_id: plan_id
      };
      const changeObject = {
        object: {
          metadata: {
            name: backup_guid,
            selfLink: `/apis/backup.servicefabrik.io/v1alpha1/namespaces/default/defaultbackups/${backup_guid}`
          },
          spec: {
            options: JSON.stringify(options)
          },
          status: {
            state: 'in_queue'
          }
        }
      };
      mocks.apiServerEventMesh.nockPatchResourceRegex('backup', 'defaultbackup', {
        metadata: {
          annotations: config.broker_ip
        }
      });
      mocks.apiServerEventMesh.nockPatchResourceRegex('backup', 'defaultbackup', {
        metadata: {
          annotations: config.broker_ip
        }
      }, 1, undefined, 404);
      const jsonStream = new JSONStream();
      initDefaultBMTest(jsonStream, sandbox, registerWatcherStub);
      return Promise.try(() => jsonStream.write(JSON.stringify(changeObject)))
        .delay(500).then(() => {
          expect(createServiceSpy.firstCall.args[0]).to.eql(catalog.getPlan(plan_id));
          expect(startBackupSpy.callCount).to.equal(1);
          expect(startBackupSpy.firstCall.args[0]).to.eql(options);
          mocks.verify();
        });
    });

  });
});