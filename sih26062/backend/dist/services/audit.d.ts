export type AuditEntityType = 'INDENT' | 'CARGO' | 'MANIFEST' | 'VOYAGE' | 'INVENTORY' | 'CONSUMPTION' | 'STOWAGE_PLAN' | 'PERSONNEL' | 'EMERGENCY';
export declare function writeAuditEvent(params: {
    actorUserId?: string;
    entityType: AuditEntityType;
    entityId?: string;
    action: string;
    oldValue?: unknown;
    newValue?: unknown;
    location?: unknown;
    notes?: string;
}): Promise<void>;
//# sourceMappingURL=audit.d.ts.map