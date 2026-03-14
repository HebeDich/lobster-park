/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AlertSeverity } from '../models/AlertSeverity';
import type { AlertStatus } from '../models/AlertStatus';
import type { AnyJsonValue } from '../models/AnyJsonValue';
import type { AssignUserRolesRequest } from '../models/AssignUserRolesRequest';
import type { ChangePasswordRequest } from '../models/ChangePasswordRequest';
import type { CreateInstanceRequest } from '../models/CreateInstanceRequest';
import type { CreateSecretRequest } from '../models/CreateSecretRequest';
import type { CreateTenantRequest } from '../models/CreateTenantRequest';
import type { CreateTenantUserRequest } from '../models/CreateTenantUserRequest';
import type { DeleteSecretRequest } from '../models/DeleteSecretRequest';
import type { EnvelopeAlert } from '../models/EnvelopeAlert';
import type { EnvelopeBase } from '../models/EnvelopeBase';
import type { EnvelopeBulkReadResult } from '../models/EnvelopeBulkReadResult';
import type { EnvelopeCancelJobResult } from '../models/EnvelopeCancelJobResult';
import type { EnvelopeConfigCurrent } from '../models/EnvelopeConfigCurrent';
import type { EnvelopeConfigDraft } from '../models/EnvelopeConfigDraft';
import type { EnvelopeConfigVersion } from '../models/EnvelopeConfigVersion';
import type { EnvelopeCurrentUser } from '../models/EnvelopeCurrentUser';
import type { EnvelopeHealth } from '../models/EnvelopeHealth';
import type { EnvelopeInstance } from '../models/EnvelopeInstance';
import type { EnvelopeJob } from '../models/EnvelopeJob';
import type { EnvelopeJobAccepted } from '../models/EnvelopeJobAccepted';
import type { EnvelopeLoginResult } from '../models/EnvelopeLoginResult';
import type { EnvelopeMonitorOverview } from '../models/EnvelopeMonitorOverview';
import type { EnvelopeNotificationReadResult } from '../models/EnvelopeNotificationReadResult';
import type { EnvelopeOpenClawBasicConfig } from '../models/EnvelopeOpenClawBasicConfig';
import type { EnvelopeOpenClawCatalogChannelPlugins } from '../models/EnvelopeOpenClawCatalogChannelPlugins';
import type { EnvelopeOpenClawCatalogChannels } from '../models/EnvelopeOpenClawCatalogChannels';
import type { EnvelopeOpenClawChannelConnectResult } from '../models/EnvelopeOpenClawChannelConnectResult';
import type { EnvelopeOpenClawChannelLogs } from '../models/EnvelopeOpenClawChannelLogs';
import type { EnvelopeOpenClawChannelRuntimeStatus } from '../models/EnvelopeOpenClawChannelRuntimeStatus';
import type { EnvelopeOpenClawChannelTestResult } from '../models/EnvelopeOpenClawChannelTestResult';
import type { EnvelopeOpenClawConsoleHistory } from '../models/EnvelopeOpenClawConsoleHistory';
import type { EnvelopeOpenClawConsoleSession } from '../models/EnvelopeOpenClawConsoleSession';
import type { EnvelopeOpenClawInstanceChannels } from '../models/EnvelopeOpenClawInstanceChannels';
import type { EnvelopeOpenClawLiveAcceptanceIndex } from '../models/EnvelopeOpenClawLiveAcceptanceIndex';
import type { EnvelopeOpenClawLiveAcceptanceReport } from '../models/EnvelopeOpenClawLiveAcceptanceReport';
import type { EnvelopeOpenClawPairingRequests } from '../models/EnvelopeOpenClawPairingRequests';
import type { EnvelopeOpenClawQrDiagnostics } from '../models/EnvelopeOpenClawQrDiagnostics';
import type { EnvelopeOpenClawQrSession } from '../models/EnvelopeOpenClawQrSession';
import type { EnvelopePagedAlerts } from '../models/EnvelopePagedAlerts';
import type { EnvelopePagedAudits } from '../models/EnvelopePagedAudits';
import type { EnvelopePagedConfigVersions } from '../models/EnvelopePagedConfigVersions';
import type { EnvelopePagedInstances } from '../models/EnvelopePagedInstances';
import type { EnvelopePagedInstanceSkills } from '../models/EnvelopePagedInstanceSkills';
import type { EnvelopePagedJobs } from '../models/EnvelopePagedJobs';
import type { EnvelopePagedNodes } from '../models/EnvelopePagedNodes';
import type { EnvelopePagedNotifications } from '../models/EnvelopePagedNotifications';
import type { EnvelopePagedPairingRequests } from '../models/EnvelopePagedPairingRequests';
import type { EnvelopePagedPlatformSettings } from '../models/EnvelopePagedPlatformSettings';
import type { EnvelopePagedRoles } from '../models/EnvelopePagedRoles';
import type { EnvelopePagedSecrets } from '../models/EnvelopePagedSecrets';
import type { EnvelopePagedSkillPackages } from '../models/EnvelopePagedSkillPackages';
import type { EnvelopePagedTemplates } from '../models/EnvelopePagedTemplates';
import type { EnvelopePagedTenants } from '../models/EnvelopePagedTenants';
import type { EnvelopePagedUsers } from '../models/EnvelopePagedUsers';
import type { EnvelopePairingRequest } from '../models/EnvelopePairingRequest';
import type { EnvelopePasswordChangeResult } from '../models/EnvelopePasswordChangeResult';
import type { EnvelopePlatformSetting } from '../models/EnvelopePlatformSetting';
import type { EnvelopeSecret } from '../models/EnvelopeSecret';
import type { EnvelopeUnreadCount } from '../models/EnvelopeUnreadCount';
import type { EnvelopeUsage } from '../models/EnvelopeUsage';
import type { EnvelopeUser } from '../models/EnvelopeUser';
import type { EnvelopeWsTicket } from '../models/EnvelopeWsTicket';
import type { InstanceLifecycleStatus } from '../models/InstanceLifecycleStatus';
import type { LoginWithPasswordRequest } from '../models/LoginWithPasswordRequest';
import type { OpenClawBasicConfigInput } from '../models/OpenClawBasicConfigInput';
import type { OpenClawChannelConnectRequest } from '../models/OpenClawChannelConnectRequest';
import type { OpenClawChannelTestRequest } from '../models/OpenClawChannelTestRequest';
import type { OpenClawPairingRejectRequest } from '../models/OpenClawPairingRejectRequest';
import type { PatchInstanceRequest } from '../models/PatchInstanceRequest';
import type { PatchTenantRequest } from '../models/PatchTenantRequest';
import type { PatchTenantUserRequest } from '../models/PatchTenantUserRequest';
import type { ResetUserPasswordRequest } from '../models/ResetUserPasswordRequest';
import type { SaveConfigDraftRequest } from '../models/SaveConfigDraftRequest';
import type { Template } from '../models/Template';
import type { UpdateSecretRequest } from '../models/UpdateSecretRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Get current user context
     * @returns EnvelopeCurrentUser ok
     * @throws ApiError
     */
    public static getCurrentUser(): CancelablePromise<EnvelopeCurrentUser> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/me',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List instances
     * @param pageNo
     * @param pageSize
     * @param keyword
     * @param lifecycleStatus
     * @returns EnvelopePagedInstances ok
     * @throws ApiError
     */
    public static listInstances(
        pageNo: number = 1,
        pageSize: number = 20,
        keyword?: string,
        lifecycleStatus?: InstanceLifecycleStatus,
    ): CancelablePromise<EnvelopePagedInstances> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
                'keyword': keyword,
                'lifecycleStatus': lifecycleStatus,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Create instance
     * @param xIdempotencyKey
     * @param requestBody
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static createInstance(
        xIdempotencyKey: string,
        requestBody: CreateInstanceRequest,
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances',
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get instance detail
     * @param instanceId
     * @returns EnvelopeInstance ok
     * @throws ApiError
     */
    public static getInstance(
        instanceId: string,
    ): CancelablePromise<EnvelopeInstance> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Delete instance
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static deleteInstance(
        instanceId: string,
        requestBody: {
            confirmText: string;
        },
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/instances/{instanceId}',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Update instance metadata
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeInstance ok
     * @throws ApiError
     */
    public static patchInstance(
        instanceId: string,
        requestBody: PatchInstanceRequest,
    ): CancelablePromise<EnvelopeInstance> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/instances/{instanceId}',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Start instance
     * @param instanceId
     * @param xIdempotencyKey
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static startInstance(
        instanceId: string,
        xIdempotencyKey: string,
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/start',
            path: {
                'instanceId': instanceId,
            },
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Stop instance
     * @param instanceId
     * @param xIdempotencyKey
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static stopInstance(
        instanceId: string,
        xIdempotencyKey: string,
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/stop',
            path: {
                'instanceId': instanceId,
            },
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Restart instance
     * @param instanceId
     * @param xIdempotencyKey
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static restartInstance(
        instanceId: string,
        xIdempotencyKey: string,
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/restart',
            path: {
                'instanceId': instanceId,
            },
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get config draft
     * @param instanceId
     * @returns EnvelopeConfigDraft ok
     * @throws ApiError
     */
    public static getConfigDraft(
        instanceId: string,
    ): CancelablePromise<EnvelopeConfigDraft> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/config/draft',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Save config draft
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeConfigDraft ok
     * @throws ApiError
     */
    public static saveConfigDraft(
        instanceId: string,
        requestBody: SaveConfigDraftRequest,
    ): CancelablePromise<EnvelopeConfigDraft> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/instances/{instanceId}/config/draft',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Validate config
     * @param instanceId
     * @param xIdempotencyKey
     * @param requestBody
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static validateConfig(
        instanceId: string,
        xIdempotencyKey: string,
        requestBody?: any,
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/config/validate',
            path: {
                'instanceId': instanceId,
            },
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            body: requestBody,
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Publish config
     * When forcePublish=true, caller must have config.force_publish permission (break-glass). Action is audited and triggers a P2 alert.
     * @param instanceId
     * @param xIdempotencyKey
     * @param requestBody
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static publishConfig(
        instanceId: string,
        xIdempotencyKey: string,
        requestBody: {
            note?: string;
            forcePublish?: boolean;
            confirmText?: string;
        },
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/config/publish',
            path: {
                'instanceId': instanceId,
            },
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List config versions
     * @param instanceId
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedConfigVersions ok
     * @throws ApiError
     */
    public static listConfigVersions(
        instanceId: string,
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedConfigVersions> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/config/versions',
            path: {
                'instanceId': instanceId,
            },
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Rollback config version
     * @param instanceId
     * @param versionId
     * @param xIdempotencyKey
     * @param requestBody
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static rollbackConfigVersion(
        instanceId: string,
        versionId: string,
        xIdempotencyKey: string,
        requestBody: {
            confirmText: string;
            note?: string;
        },
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/config/versions/{versionId}/rollback',
            path: {
                'instanceId': instanceId,
                'versionId': versionId,
            },
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List instance nodes
     * @param instanceId
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedNodes ok
     * @throws ApiError
     */
    public static listInstanceNodes(
        instanceId: string,
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedNodes> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/nodes',
            path: {
                'instanceId': instanceId,
            },
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List instance secrets (masked)
     * Returns a paginated list of secrets for the given instance. Only masked previews are returned; cipher values are never exposed.
     *
     * @param instanceId
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedSecrets ok
     * @throws ApiError
     */
    public static listInstanceSecrets(
        instanceId: string,
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedSecrets> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/secrets',
            path: {
                'instanceId': instanceId,
            },
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Create instance secret
     * Encrypts the provided secret value with AES-256-GCM and stores it. The plain-text value is never persisted or returned.
     *
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeSecret created
     * @throws ApiError
     */
    public static createInstanceSecret(
        instanceId: string,
        requestBody: CreateSecretRequest,
    ): CancelablePromise<EnvelopeSecret> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/secrets',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                409: `secret_key already exists for this instance`,
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Update instance secret
     * Updates the secret value and/or expiration. If secretValue is provided, the cipher is re-encrypted and secret_version incremented.
     *
     * @param instanceId
     * @param secretKey [V1.4] Secret key identifier within an instance
     * @param requestBody
     * @returns EnvelopeSecret ok
     * @throws ApiError
     */
    public static updateInstanceSecret(
        instanceId: string,
        secretKey: string,
        requestBody: UpdateSecretRequest,
    ): CancelablePromise<EnvelopeSecret> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/instances/{instanceId}/secrets/{secretKey}',
            path: {
                'instanceId': instanceId,
                'secretKey': secretKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `secret not found`,
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Delete instance secret
     * Hard-deletes the secret. Fails if the secret is referenced by the current active config version.
     *
     * @param instanceId
     * @param secretKey [V1.4] Secret key identifier within an instance
     * @param requestBody
     * @returns EnvelopeBase ok
     * @throws ApiError
     */
    public static deleteInstanceSecret(
        instanceId: string,
        secretKey: string,
        requestBody: DeleteSecretRequest,
    ): CancelablePromise<EnvelopeBase> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/instances/{instanceId}/secrets/{secretKey}',
            path: {
                'instanceId': instanceId,
                'secretKey': secretKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                409: `secret is referenced by active config`,
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List pairing requests
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedPairingRequests ok
     * @throws ApiError
     */
    public static listPairingRequests(
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedPairingRequests> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/nodes/pairing-requests',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Approve pairing request
     * @param requestId
     * @returns EnvelopePairingRequest ok
     * @throws ApiError
     */
    public static approvePairingRequest(
        requestId: string,
    ): CancelablePromise<EnvelopePairingRequest> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/nodes/pairing-requests/{requestId}/approve',
            path: {
                'requestId': requestId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Reject pairing request
     * @param requestId
     * @param requestBody
     * @returns EnvelopePairingRequest ok
     * @throws ApiError
     */
    public static rejectPairingRequest(
        requestId: string,
        requestBody?: {
            reason?: string;
        },
    ): CancelablePromise<EnvelopePairingRequest> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/nodes/pairing-requests/{requestId}/reject',
            path: {
                'requestId': requestId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get instance health
     * @param instanceId
     * @returns EnvelopeHealth ok
     * @throws ApiError
     */
    public static getInstanceHealth(
        instanceId: string,
    ): CancelablePromise<EnvelopeHealth> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/health',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get instance usage
     * @param instanceId
     * @param from
     * @param to
     * @returns EnvelopeUsage ok
     * @throws ApiError
     */
    public static getInstanceUsage(
        instanceId: string,
        from?: string,
        to?: string,
    ): CancelablePromise<EnvelopeUsage> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/usage',
            path: {
                'instanceId': instanceId,
            },
            query: {
                'from': from,
                'to': to,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List alerts
     * @param pageNo
     * @param pageSize
     * @param status
     * @param severity
     * @param instanceId [V1.4] Filter by instance ID
     * @param tenantId [V1.4] Filter by tenant ID (platform admin only; other roles auto-scoped)
     * @returns EnvelopePagedAlerts ok
     * @throws ApiError
     */
    public static listAlerts(
        pageNo: number = 1,
        pageSize: number = 20,
        status?: AlertStatus,
        severity?: AlertSeverity,
        instanceId?: string,
        tenantId?: string,
    ): CancelablePromise<EnvelopePagedAlerts> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/alerts',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
                'status': status,
                'severity': severity,
                'instanceId': instanceId,
                'tenantId': tenantId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Acknowledge alert
     * @param alertId
     * @returns EnvelopeAlert ok
     * @throws ApiError
     */
    public static ackAlert(
        alertId: string,
    ): CancelablePromise<EnvelopeAlert> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/alerts/{alertId}/ack',
            path: {
                'alertId': alertId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Resolve alert
     * @param alertId
     * @returns EnvelopeAlert ok
     * @throws ApiError
     */
    public static resolveAlert(
        alertId: string,
    ): CancelablePromise<EnvelopeAlert> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/alerts/{alertId}/resolve',
            path: {
                'alertId': alertId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List audit logs
     * @param pageNo
     * @param pageSize
     * @param tenantId
     * @param instanceId
     * @param actionType
     * @param operatorId
     * @param actionResult
     * @param startTime
     * @param endTime
     * @param riskLevel
     * @returns EnvelopePagedAudits ok
     * @throws ApiError
     */
    public static listAudits(
        pageNo: number = 1,
        pageSize: number = 20,
        tenantId?: string,
        instanceId?: string,
        actionType?: string,
        operatorId?: string,
        actionResult?: 'success' | 'failed',
        startTime?: string,
        endTime?: string,
        riskLevel?: string,
    ): CancelablePromise<EnvelopePagedAudits> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/audits',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
                'tenantId': tenantId,
                'instanceId': instanceId,
                'actionType': actionType,
                'operatorId': operatorId,
                'actionResult': actionResult,
                'startTime': startTime,
                'endTime': endTime,
                'riskLevel': riskLevel,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List jobs
     * @param pageNo
     * @param pageSize
     * @param instanceId
     * @param jobType
     * @param jobStatus
     * @returns EnvelopePagedJobs ok
     * @throws ApiError
     */
    public static listJobs(
        pageNo: number = 1,
        pageSize: number = 20,
        instanceId?: string,
        jobType?: string,
        jobStatus?: string,
    ): CancelablePromise<EnvelopePagedJobs> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/jobs',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
                'instanceId': instanceId,
                'jobType': jobType,
                'jobStatus': jobStatus,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get job detail
     * @param jobId
     * @returns EnvelopeJob ok
     * @throws ApiError
     */
    public static getJob(
        jobId: string,
    ): CancelablePromise<EnvelopeJob> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/jobs/{jobId}',
            path: {
                'jobId': jobId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Liveness probe
     * Anonymous probe endpoint. Exposure should be limited by network policy.
     * @returns any ok
     * @throws ApiError
     */
    public static getHealth(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/health',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Readiness probe
     * Anonymous readiness endpoint. Exposure should be limited by network policy.
     * @returns any ok
     * @throws ApiError
     */
    public static getReady(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/ready',
            errors: {
                429: `Rate limit exceeded`,
                503: `not ready`,
            },
        });
    }
    /**
     * Prometheus metrics
     * Anonymous scrape endpoint. Must be protected by ingress/internal network policy.
     * @returns any ok
     * @throws ApiError
     */
    public static getMetrics(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/metrics',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Build info
     * Anonymous build metadata endpoint. Must be protected by ingress/internal network policy.
     * @returns any ok
     * @throws ApiError
     */
    public static getInfo(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/info',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Login with email and password
     * @param requestBody
     * @returns EnvelopeLoginResult ok
     * @throws ApiError
     */
    public static loginWithPassword(
        requestBody: LoginWithPasswordRequest,
    ): CancelablePromise<EnvelopeLoginResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Change current user password
     * @param requestBody
     * @returns EnvelopePasswordChangeResult ok
     * @throws ApiError
     */
    public static changePassword(
        requestBody: ChangePasswordRequest,
    ): CancelablePromise<EnvelopePasswordChangeResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/change-password',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Refresh session
     * @returns EnvelopeCurrentUser ok
     * @throws ApiError
     */
    public static refreshSession(): CancelablePromise<EnvelopeCurrentUser> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/refresh',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Logout current session
     * @returns EnvelopeBase ok
     * @throws ApiError
     */
    public static logoutSession(): CancelablePromise<EnvelopeBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/logout',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List tenants
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedTenants ok
     * @throws ApiError
     */
    public static listTenants(
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedTenants> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tenants',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Create tenant
     * Requires `tenant.create` permission. Only platform super admins may call this endpoint.
     * @param requestBody
     * @returns EnvelopeBase created
     * @throws ApiError
     */
    public static createTenant(
        requestBody: CreateTenantRequest,
    ): CancelablePromise<EnvelopeBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tenants',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List tenant users
     * @param tenantId
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedUsers ok
     * @throws ApiError
     */
    public static listTenantUsers(
        tenantId: string,
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedUsers> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tenants/{tenantId}/users',
            path: {
                'tenantId': tenantId,
            },
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Create tenant user
     * @param tenantId
     * @param requestBody
     * @returns EnvelopeUser ok
     * @throws ApiError
     */
    public static createTenantUser(
        tenantId: string,
        requestBody: CreateTenantUserRequest,
    ): CancelablePromise<EnvelopeUser> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tenants/{tenantId}/users',
            path: {
                'tenantId': tenantId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Patch tenant user
     * @param tenantId
     * @param userId
     * @param requestBody
     * @returns EnvelopeUser ok
     * @throws ApiError
     */
    public static patchTenantUser(
        tenantId: string,
        userId: string,
        requestBody: PatchTenantUserRequest,
    ): CancelablePromise<EnvelopeUser> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tenants/{tenantId}/users/{userId}',
            path: {
                'tenantId': tenantId,
                'userId': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Reset user password
     * @param userId
     * @param requestBody
     * @returns EnvelopeUser ok
     * @throws ApiError
     */
    public static resetUserPassword(
        userId: string,
        requestBody: ResetUserPasswordRequest,
    ): CancelablePromise<EnvelopeUser> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/users/{userId}/reset-password',
            path: {
                'userId': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List roles
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedRoles ok
     * @throws ApiError
     */
    public static listRoles(
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedRoles> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/roles',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Assign user roles
     * @param userId
     * @param requestBody
     * @returns EnvelopeUser ok
     * @throws ApiError
     */
    public static assignUserRoles(
        userId: string,
        requestBody: AssignUserRolesRequest,
    ): CancelablePromise<EnvelopeUser> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/users/{userId}/roles',
            path: {
                'userId': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Restore soft deleted instance
     * @param instanceId
     * @param xIdempotencyKey
     * @returns EnvelopeJobAccepted accepted
     * @throws ApiError
     */
    public static restoreInstance(
        instanceId: string,
        xIdempotencyKey: string,
    ): CancelablePromise<EnvelopeJobAccepted> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/restore',
            path: {
                'instanceId': instanceId,
            },
            headers: {
                'X-Idempotency-Key': xIdempotencyKey,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Export config draft
     * @param instanceId
     * @returns EnvelopeConfigDraft ok
     * @throws ApiError
     */
    public static exportConfigDraft(
        instanceId: string,
    ): CancelablePromise<EnvelopeConfigDraft> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/config/export',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Import config draft
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeConfigDraft ok
     * @throws ApiError
     */
    public static importConfigDraft(
        instanceId: string,
        requestBody: SaveConfigDraftRequest,
    ): CancelablePromise<EnvelopeConfigDraft> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/config/import',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get current active config
     * Used together with config/draft or version detail for client-side diff rendering in V1.
     * @param instanceId
     * @returns EnvelopeConfigCurrent ok
     * @throws ApiError
     */
    public static getCurrentConfig(
        instanceId: string,
    ): CancelablePromise<EnvelopeConfigCurrent> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/config/current',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get instance OpenClaw basic config
     * @param instanceId
     * @returns EnvelopeOpenClawBasicConfig ok
     * @throws ApiError
     */
    public static getOpenClawBasicConfig(
        instanceId: string,
    ): CancelablePromise<EnvelopeOpenClawBasicConfig> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/basic-config',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Save instance OpenClaw basic config into draft
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeOpenClawBasicConfig ok
     * @throws ApiError
     */
    public static saveOpenClawBasicConfig(
        instanceId: string,
        requestBody: OpenClawBasicConfigInput,
    ): CancelablePromise<EnvelopeOpenClawBasicConfig> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/instances/{instanceId}/openclaw/basic-config',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List OpenClaw channels for instance
     * @param instanceId
     * @returns EnvelopeOpenClawInstanceChannels ok
     * @throws ApiError
     */
    public static listOpenClawInstanceChannels(
        instanceId: string,
    ): CancelablePromise<EnvelopeOpenClawInstanceChannels> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/channels',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Connect or update an OpenClaw channel
     * @param instanceId
     * @param channelType
     * @param requestBody
     * @returns EnvelopeOpenClawChannelConnectResult ok
     * @throws ApiError
     */
    public static connectOpenClawChannel(
        instanceId: string,
        channelType: string,
        requestBody: OpenClawChannelConnectRequest,
    ): CancelablePromise<EnvelopeOpenClawChannelConnectResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/openclaw/channels/{channelType}/connect',
            path: {
                'instanceId': instanceId,
                'channelType': channelType,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Test an OpenClaw channel connection
     * @param instanceId
     * @param channelType
     * @param requestBody
     * @returns EnvelopeOpenClawChannelTestResult ok
     * @throws ApiError
     */
    public static testOpenClawChannel(
        instanceId: string,
        channelType: string,
        requestBody: OpenClawChannelTestRequest,
    ): CancelablePromise<EnvelopeOpenClawChannelTestResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/openclaw/channels/{channelType}/test',
            path: {
                'instanceId': instanceId,
                'channelType': channelType,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get runtime session status for an OpenClaw channel
     * @param instanceId
     * @param channelType
     * @returns EnvelopeOpenClawChannelRuntimeStatus ok
     * @throws ApiError
     */
    public static getOpenClawChannelRuntimeStatus(
        instanceId: string,
        channelType: string,
    ): CancelablePromise<EnvelopeOpenClawChannelRuntimeStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/channels/{channelType}/runtime-status',
            path: {
                'instanceId': instanceId,
                'channelType': channelType,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get recent OpenClaw channel logs for an instance channel
     * @param instanceId
     * @param channelType
     * @param lines
     * @returns EnvelopeOpenClawChannelLogs ok
     * @throws ApiError
     */
    public static getOpenClawChannelLogs(
        instanceId: string,
        channelType: string,
        lines?: number,
    ): CancelablePromise<EnvelopeOpenClawChannelLogs> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/channels/{channelType}/logs',
            path: {
                'instanceId': instanceId,
                'channelType': channelType,
            },
            query: {
                'lines': lines,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get QR/session diagnostics for a QR-based OpenClaw channel
     * @param instanceId
     * @param channelType
     * @returns EnvelopeOpenClawQrDiagnostics ok
     * @throws ApiError
     */
    public static getOpenClawQrDiagnostics(
        instanceId: string,
        channelType: string,
    ): CancelablePromise<EnvelopeOpenClawQrDiagnostics> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/channels/{channelType}/qr-diagnostics',
            path: {
                'instanceId': instanceId,
                'channelType': channelType,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Start QR login session for a QR-based OpenClaw channel
     * @param instanceId
     * @param channelType
     * @param requestBody
     * @returns EnvelopeOpenClawQrSession ok
     * @throws ApiError
     */
    public static startOpenClawQrSession(
        instanceId: string,
        channelType: string,
        requestBody?: Record<string, any>,
    ): CancelablePromise<EnvelopeOpenClawQrSession> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/openclaw/channels/{channelType}/qr-session/start',
            path: {
                'instanceId': instanceId,
                'channelType': channelType,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Wait for QR login completion for a QR-based OpenClaw channel
     * @param instanceId
     * @param channelType
     * @param timeoutMs
     * @returns EnvelopeOpenClawQrSession ok
     * @throws ApiError
     */
    public static waitOpenClawQrSession(
        instanceId: string,
        channelType: string,
        timeoutMs?: number,
    ): CancelablePromise<EnvelopeOpenClawQrSession> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/channels/{channelType}/qr-session/wait',
            path: {
                'instanceId': instanceId,
                'channelType': channelType,
            },
            query: {
                'timeoutMs': timeoutMs,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List instance OpenClaw pairing requests
     * @param instanceId
     * @returns EnvelopeOpenClawPairingRequests ok
     * @throws ApiError
     */
    public static listOpenClawInstancePairingRequests(
        instanceId: string,
    ): CancelablePromise<EnvelopeOpenClawPairingRequests> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/pairing-requests',
            path: {
                'instanceId': instanceId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Approve instance OpenClaw pairing request
     * @param instanceId
     * @param pairingCode
     * @returns EnvelopePairingRequest ok
     * @throws ApiError
     */
    public static approveOpenClawInstancePairingRequest(
        instanceId: string,
        pairingCode: string,
    ): CancelablePromise<EnvelopePairingRequest> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/openclaw/pairing-requests/{pairingCode}/approve',
            path: {
                'instanceId': instanceId,
                'pairingCode': pairingCode,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Reject instance OpenClaw pairing request
     * @param instanceId
     * @param pairingCode
     * @param requestBody
     * @returns EnvelopePairingRequest ok
     * @throws ApiError
     */
    public static rejectOpenClawInstancePairingRequest(
        instanceId: string,
        pairingCode: string,
        requestBody?: OpenClawPairingRejectRequest,
    ): CancelablePromise<EnvelopePairingRequest> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/openclaw/pairing-requests/{pairingCode}/reject',
            path: {
                'instanceId': instanceId,
                'pairingCode': pairingCode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Create instance OpenClaw console session snapshot
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeOpenClawConsoleSession ok
     * @throws ApiError
     */
    public static createOpenClawConsoleSession(
        instanceId: string,
        requestBody?: Record<string, any>,
    ): CancelablePromise<EnvelopeOpenClawConsoleSession> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/openclaw/console/session',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Send a message through instance OpenClaw console
     * @param instanceId
     * @param requestBody
     * @returns EnvelopeOpenClawConsoleSession ok
     * @throws ApiError
     */
    public static sendOpenClawConsoleMessage(
        instanceId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<EnvelopeOpenClawConsoleSession> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/openclaw/console/send',
            path: {
                'instanceId': instanceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get recent instance OpenClaw console history
     * @param instanceId
     * @param limit
     * @returns EnvelopeOpenClawConsoleHistory ok
     * @throws ApiError
     */
    public static getOpenClawConsoleHistory(
        instanceId: string,
        limit?: number,
    ): CancelablePromise<EnvelopeOpenClawConsoleHistory> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/openclaw/console/history',
            path: {
                'instanceId': instanceId,
            },
            query: {
                'limit': limit,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get config version detail
     * @param instanceId
     * @param versionId
     * @returns EnvelopeConfigVersion ok
     * @throws ApiError
     */
    public static getConfigVersionDetail(
        instanceId: string,
        versionId: string,
    ): CancelablePromise<EnvelopeConfigVersion> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/config/versions/{versionId}',
            path: {
                'instanceId': instanceId,
                'versionId': versionId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Detach node from instance
     * @param instanceId
     * @param nodeId
     * @param requestBody
     * @returns EnvelopePairingRequest ok
     * @throws ApiError
     */
    public static detachNode(
        instanceId: string,
        nodeId: string,
        requestBody: {
            confirmText: string;
            reason?: string;
        },
    ): CancelablePromise<EnvelopePairingRequest> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/nodes/{nodeId}/detach',
            path: {
                'instanceId': instanceId,
                'nodeId': nodeId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get monitor overview
     * @param pageNo
     * @param pageSize
     * @returns EnvelopeMonitorOverview ok
     * @throws ApiError
     */
    public static getMonitorOverview(
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopeMonitorOverview> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/monitor/overview',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get alert detail
     * @param alertId
     * @returns EnvelopeAlert ok
     * @throws ApiError
     */
    public static getAlert(
        alertId: string,
    ): CancelablePromise<EnvelopeAlert> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/alerts/{alertId}',
            path: {
                'alertId': alertId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List current user notifications
     * @param pageNo
     * @param pageSize
     * @param isRead [V1.4] Filter by read status. true=read, false=unread, omit=all
     * @param eventType [V1.4] Filter by event type, e.g. alert.triggered, job.completed
     * @returns EnvelopePagedNotifications ok
     * @throws ApiError
     */
    public static listNotifications(
        pageNo: number = 1,
        pageSize: number = 20,
        isRead?: boolean,
        eventType?: string,
    ): CancelablePromise<EnvelopePagedNotifications> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/notifications',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
                'isRead': isRead,
                'eventType': eventType,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get current user unread notification count
     * @returns EnvelopeUnreadCount ok
     * @throws ApiError
     */
    public static getUnreadNotificationCount(): CancelablePromise<EnvelopeUnreadCount> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/notifications/unread-count',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Mark notification as read
     * @param notificationId
     * @returns EnvelopeNotificationReadResult ok
     * @throws ApiError
     */
    public static markNotificationRead(
        notificationId: string,
    ): CancelablePromise<EnvelopeNotificationReadResult> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/notifications/{notificationId}/read',
            path: {
                'notificationId': notificationId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Mark all notifications as read
     * @returns EnvelopeBulkReadResult ok
     * @throws ApiError
     */
    public static markAllNotificationsRead(): CancelablePromise<EnvelopeBulkReadResult> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/notifications/read-all',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Cancel job
     * @param jobId
     * @returns EnvelopeCancelJobResult ok
     * @throws ApiError
     */
    public static cancelJob(
        jobId: string,
    ): CancelablePromise<EnvelopeCancelJobResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/jobs/{jobId}/cancel',
            path: {
                'jobId': jobId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List skill packages visible to current tenant
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedSkillPackages ok
     * @throws ApiError
     */
    public static listSkillPackages(
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedSkillPackages> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/catalog/skills',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List platform-supported OpenClaw channels
     * @returns EnvelopeOpenClawCatalogChannels ok
     * @throws ApiError
     */
    public static listOpenClawCatalogChannels(): CancelablePromise<EnvelopeOpenClawCatalogChannels> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/catalog/channels',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List platform-supported OpenClaw channel plugins
     * @returns EnvelopeOpenClawCatalogChannelPlugins ok
     * @throws ApiError
     */
    public static listOpenClawCatalogChannelPlugins(): CancelablePromise<EnvelopeOpenClawCatalogChannelPlugins> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/catalog/channel-plugins',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List skills with instance enabled status
     * @param instanceId
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedInstanceSkills ok
     * @throws ApiError
     */
    public static listInstanceSkills(
        instanceId: string,
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedInstanceSkills> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/instances/{instanceId}/skills',
            path: {
                'instanceId': instanceId,
            },
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Enable skill on instance
     * @param instanceId
     * @param skillId
     * @returns EnvelopeBase ok
     * @throws ApiError
     */
    public static enableSkill(
        instanceId: string,
        skillId: string,
    ): CancelablePromise<EnvelopeBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/skills/{skillId}/enable',
            path: {
                'instanceId': instanceId,
                'skillId': skillId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Disable skill on instance
     * @param instanceId
     * @param skillId
     * @returns EnvelopeBase ok
     * @throws ApiError
     */
    public static disableSkill(
        instanceId: string,
        skillId: string,
    ): CancelablePromise<EnvelopeBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/instances/{instanceId}/skills/{skillId}/disable',
            path: {
                'instanceId': instanceId,
                'skillId': skillId,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List built-in templates
     * @param pageNo
     * @param pageSize
     * @returns EnvelopePagedTemplates ok
     * @throws ApiError
     */
    public static listTemplates(
        pageNo: number = 1,
        pageSize: number = 20,
    ): CancelablePromise<EnvelopePagedTemplates> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/catalog/templates',
            query: {
                'pageNo': pageNo,
                'pageSize': pageSize,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Create platform template (V1.5)
     * @param requestBody
     * @returns EnvelopeBase ok
     * @throws ApiError
     */
    public static createPlatformTemplate(
        requestBody: Template,
    ): CancelablePromise<EnvelopeBase> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/platform/templates',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Initiate OIDC SSO authorization
     * @param redirectUri Same-origin relative path only, e.g. /workbench. Absolute URLs are rejected and fall back to /workbench.
     * @returns void
     * @throws ApiError
     */
    public static authorizeSso(
        redirectUri?: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/sso/authorize',
            query: {
                'redirect_uri': redirectUri,
            },
            errors: {
                302: `Temporary redirect`,
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * OIDC authorization callback
     * @param code
     * @param state
     * @returns void
     * @throws ApiError
     */
    public static handleSsoCallback(
        code: string,
        state: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/sso/callback',
            query: {
                'code': code,
                'state': state,
            },
            errors: {
                302: `Temporary redirect`,
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Patch tenant metadata and quota
     * @param tenantId
     * @param requestBody
     * @returns EnvelopeBase ok
     * @throws ApiError
     */
    public static patchTenant(
        tenantId: string,
        requestBody: PatchTenantRequest,
    ): CancelablePromise<EnvelopeBase> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/tenants/{tenantId}',
            path: {
                'tenantId': tenantId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Issue one-time WebSocket ticket
     * @returns EnvelopeWsTicket ok
     * @throws ApiError
     */
    public static issueWsTicket(): CancelablePromise<EnvelopeWsTicket> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/ws/ticket',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * List platform settings
     * @returns EnvelopePagedPlatformSettings ok
     * @throws ApiError
     */
    public static listPlatformSettings(): CancelablePromise<EnvelopePagedPlatformSettings> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/platform/settings',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get platform setting
     * @param settingKey Platform setting key
     * @returns EnvelopePlatformSetting ok
     * @throws ApiError
     */
    public static getPlatformSetting(
        settingKey: string,
    ): CancelablePromise<EnvelopePlatformSetting> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/platform/settings/{settingKey}',
            path: {
                'settingKey': settingKey,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Update platform setting
     * @param settingKey Platform setting key
     * @param requestBody
     * @returns EnvelopePlatformSetting ok
     * @throws ApiError
     */
    public static putPlatformSetting(
        settingKey: string,
        requestBody: {
            settingValueJson: AnyJsonValue;
        },
    ): CancelablePromise<EnvelopePlatformSetting> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/platform/settings/{settingKey}',
            path: {
                'settingKey': settingKey,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get JSON schema for a runtime version
     * @param runtimeVersion Approved OpenClaw runtime version
     * @returns any ok
     * @throws ApiError
     */
    public static getRuntimeSchema(
        runtimeVersion: string,
    ): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/platform/schemas/{runtimeVersion}',
            path: {
                'runtimeVersion': runtimeVersion,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get OpenClaw live acceptance report index
     * @returns EnvelopeOpenClawLiveAcceptanceIndex ok
     * @throws ApiError
     */
    public static getOpenClawLiveAcceptanceIndex(): CancelablePromise<EnvelopeOpenClawLiveAcceptanceIndex> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/platform/openclaw/live-acceptance-reports',
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
    /**
     * Get one OpenClaw live acceptance report
     * @param reportFileName
     * @returns EnvelopeOpenClawLiveAcceptanceReport ok
     * @throws ApiError
     */
    public static getOpenClawLiveAcceptanceReport(
        reportFileName: string,
    ): CancelablePromise<EnvelopeOpenClawLiveAcceptanceReport> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/platform/openclaw/live-acceptance-reports/{reportFileName}',
            path: {
                'reportFileName': reportFileName,
            },
            errors: {
                429: `Rate limit exceeded`,
            },
        });
    }
}
