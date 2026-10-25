export type DeletionPlan = {kind:'account'|'relationship';id:string;name:string;confirmation:string;revision:string;blockers:string[];cleanup:Record<string,number>};
