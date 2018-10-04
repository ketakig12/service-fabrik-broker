## How to bring your own provisioner/manager

Basic principle of how a manager can be brought in SF2.0 is depicted in the below picture.

![Missing](https://github.com/cloudfoundry-incubator/service-fabrik-broker/blob/gh-pages/architecture/SF2.0-basics.png?raw=true)

To bring in a new provisioner, one has to bring in their own [CRD](https://kubernetes.io/docs/tasks/access-kubernetes-api/custom-resources/custom-resource-definitions/)

A sample CRD for a deployment looks like [this](https://github.com/cloudfoundry-incubator/service-fabrik-broker/blob/master/broker/config/crds/deployment.servicefabrik.io_v1alpha1_directors.yaml). 
One can create a CRD similar to this. [Kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) also can be used to build such CRD. 

Once the CRD is created, the new provisioners can be integrated doing the following steps.

1. Add your services, similar to [this](https://github.com/cloudfoundry-incubator/service-fabrik-broker/blob/master/broker/config/settings.yml#L556-L580) and 
plans similar to [this](https://github.com/cloudfoundry-incubator/service-fabrik-broker/blob/master/broker/config/settings.yml#L696-L738).

2. Make sure the resource mappings are added properly in the plan metadata, simialr to [this](https://github.com/cloudfoundry-incubator/service-fabrik-broker/blob/master/broker/config/settings.yml#L704-L712).

3. Start your manager and do the following:

   1. Register the CRD with Service Fabrik APIServer.
   2. Start watching on the CRD for state change.
   3. Process create/update/delete depending  on the state change.
