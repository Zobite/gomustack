export function HandlerSdkReference() {
  return (
    <div className="border border-hairline rounded-lg p-5 bg-surface-card">
      <div className="font-mono text-[10px] text-muted-soft uppercase tracking-wider mb-3">Handler SDK Reference</div>
      <div className="font-mono text-[11px] text-muted leading-[1.7] space-y-3">
        {/* Request */}
        <div>
          <div className="text-[10px] text-muted-soft uppercase tracking-wider mb-1">request</div>
          <div className="pl-3 space-y-0.5">
            <div>
              <span className="text-[#8b5cf6]">.method</span>
              <span className="text-muted-soft"> : string</span>
              <span className="text-muted-soft ml-2">— GET, POST, PUT, PATCH, DELETE</span>
            </div>
            <div>
              <span className="text-[#8b5cf6]">.path</span>
              <span className="text-muted-soft"> : string</span>
              <span className="text-muted-soft ml-2">— e.g. /users/123</span>
            </div>
            <div>
              <span className="text-[#8b5cf6]">.params</span>
              <span className="text-muted-soft">{" : { [key]: string }"}</span>
              <span className="text-muted-soft ml-2">— path params (:id → params.id)</span>
            </div>
            <div>
              <span className="text-[#8b5cf6]">.query</span>
              <span className="text-muted-soft">{" : { [key]: string }"}</span>
              <span className="text-muted-soft ml-2">— ?page=1&limit=10</span>
            </div>
            <div>
              <span className="text-[#8b5cf6]">.headers</span>
              <span className="text-muted-soft">{" : { [key]: string }"}</span>
            </div>
            <div>
              <span className="text-[#8b5cf6]">.body</span>
              <span className="text-muted-soft"> : any | null</span>
              <span className="text-muted-soft ml-2">— auto-parsed JSON</span>
            </div>
          </div>
        </div>

        {/* Context */}
        <div>
          <div className="text-[10px] text-muted-soft uppercase tracking-wider mb-1">context</div>
          <div className="pl-3">
            <div>
              <span className="text-[#8b5cf6]">.log</span>
              <span className="text-muted-soft">(...args)</span>
              <span className="text-muted-soft ml-2">— captured to execution logs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
