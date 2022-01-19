NAMESPACE := ${if ${NAMESPACE},${NAMESPACE},orchest}
KUBECONFIG := ${if ${KUBECONFIG},${KUBECONFIG},~/.kube/config}

DEFAULT_TAG := ${if ${DEFAULT_TAG},${DEFAULT_TAG},latest}

DEBUG := ${if ${DEBUG},--debug --dry-run --disable-openapi-validation,}

#Orchest API configs
ORCHEST_API_TAG := ${if ${ORCHEST_API_TAG},${ORCHEST_API_TAG},${DEFAULT_TAG}}
ORCHEST_API_SERVICE_CONFIG := $(if ${ORCHEST_API_DEV_SRVC},--set orchest-api.service.dev=true \
					 --set orchest-api.service.type=ExternalName \
					 --set orchest-api.service.externalName=${ORCHEST_API_DEV_SRVC},)
ORCHEST_API_CONFIG := ${ORCHEST_API_SERVICE_CONFIG}


SHARED_DEPLOY_CONFIG := --kubeconfig ${KUBECONFIG} \
	${DEBUG} --namespace ${NAMESPACE} --create-namespace

ORCHEST_DEPLOY_CONFIG := orchest \
	${SHARED_DEPLOY_CONFIG} ${ORCHEST_API_CONFIG} helm

ROOK_DEPLOY_CONFIG := rook \
	${SHARED_DEPLOY_CONFIG} thirdparty/rook/rook-ceph -f values-override.yaml .

JUPYTER_EGW_DEPLOY_CONFIG := jupyter-egw \
	${SHARED_DEPLOY_CONFIG} thirdparty/enterprise-gateway

ARGO_WORKFLOW_DEPLOY_CONFIG := argo-workflow \
	${SHARED_DEPLOY_CONFIG} thirdparty/argo-workflows

.PHONY: orchest
orchest: argo-workflow
	helm install ${ORCHEST_DEPLOY_CONFIG}

.PHONY: jupyter-egw
jupyter-egw:
	helm install ${JUPYTER_EGW_DEPLOY_CONFIG}

.PHONY: argo-workflow
argo-workflow:
	helm install ${ARGO_WORKFLOW_DEPLOY_CONFIG}	

.PHONY: rook
rook:
	helm install ${ROOK_DEPLOY_CONFIG}

.PHONY: orchest_upgrade
orchest_upgrade:
	helm upgrade --install ${ORCHEST_DEPLOY_CONFIG}