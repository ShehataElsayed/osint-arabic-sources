import{WorkflowConflict}from'./workflow-runner.mjs';
export class D1WorkflowStore{
 constructor(db){this.db=db}
 async create(run){const id=crypto.randomUUID(),record={...structuredClone(run),id};await this.db.prepare('INSERT INTO workflow_runs(id,tenant,revision,content) VALUES (?,?,?,?)').bind(id,run.tenant,1,JSON.stringify(record)).run();return record}
 async read(tenant,id){const r=await this.db.prepare('SELECT content FROM workflow_runs WHERE tenant=? AND id=?').bind(tenant,id).first();return r?JSON.parse(r.content):null}
 async compareAndSet(tenant,id,revision,next){if(next.tenant!==tenant||next.id!==id)throw new WorkflowConflict('destination mismatch');const record={...structuredClone(next),revision:revision+1},text=JSON.stringify(record);if(new TextEncoder().encode(text).length>512000)throw new WorkflowConflict('workflow pilot capacity exceeded');const r=await this.db.prepare('UPDATE workflow_runs SET revision=?,content=? WHERE tenant=? AND id=? AND revision=?').bind(record.revision,text,tenant,id,revision).run();if(r.meta.changes!==1)throw new WorkflowConflict('workflow changed');return record}
}
