import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, ErrorNotice } from "@/components/ui/fields";
import { Checkbox } from "@/components/ui/checkbox";
import { useCommands, useProject } from "@/state/project-context";
import { errorMessage, type Prop, type Shot } from "@/domain/schema";

export function PropsPage({
  onEditShot,
}: {
  onEditShot: (shot: Shot) => void;
}) {
  const { project } = useProject();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const prop = project.props.find((item) => item.id === selected);
  useEffect(() => {
    heading.current?.focus();
  }, [selected, creating]);
  if (creating || prop)
    return (
      <main className="props-page">
        <Button
          variant="ghost"
          onClick={() => {
            setCreating(false);
            setSelected(null);
          }}
        >
          <ArrowLeft size={16} />
          All props
        </Button>
        <h1 ref={heading} tabIndex={-1}>
          {prop?.name ?? "New prop"}
        </h1>
        <PropDetails
          key={prop?.id ?? "new"}
          prop={prop}
          onEditShot={onEditShot}
          onCreated={(id) => {
            setCreating(false);
            setSelected(id);
          }}
          onDeleted={() => setSelected(null)}
        />
      </main>
    );
  const visible = project.props.filter((item) =>
    `${item.name} ${item.notes}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="props-page">
      <div className="props-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            Props <span className="count-badge">{project.props.length}</span>
          </h1>
          <p className="muted">Track props and the shots that use them.</p>
        </div>
        <Button variant="default" onClick={() => setCreating(true)}>
          <Plus size={16} />
          New prop
        </Button>
      </div>
      <Field label="Search props">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or notes"
        />
      </Field>
      <div className="props-list">
        {visible.map((item) => {
          const shots = project.shots.filter((shot) =>
            shot.propIds.includes(item.id),
          );
          const scenes = new Set(
            shots.map((shot) => shot.sceneLabel).filter(Boolean),
          );
          return (
            <button
              className="prop-row"
              key={item.id}
              onClick={() => setSelected(item.id)}
            >
              <span>
                <strong>{item.name}</strong>
                <small>{item.notes || "No notes"}</small>
              </span>
              <span className="muted">
                {scenes.size} scenes · {shots.length} shots
              </span>
            </button>
          );
        })}
        {!visible.length && (
          <div className="empty-copy">
            {search
              ? "No props match this search."
              : "No props yet. Create your first prop, then tag it in a shot."}
          </div>
        )}
      </div>
    </main>
  );
}

function PropDetails({
  prop,
  onCreated,
  onDeleted,
  onEditShot,
}: {
  prop?: Prop;
  onCreated: (id: string) => void;
  onDeleted: () => void;
  onEditShot: (shot: Shot) => void;
}) {
  const { project } = useProject();
  const { commit } = useCommands();
  const [name, setName] = useState(prop?.name ?? "");
  const [notes, setNotes] = useState(prop?.notes ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const linked = prop
    ? project.shots.filter((shot) => shot.propIds.includes(prop.id))
    : [];
  const groups = new Map<string, Shot[]>();
  for (const shot of linked) {
    const scene = shot.sceneLabel || "No scene label";
    groups.set(scene, [...(groups.get(scene) ?? []), shot]);
  }
  return (
    <>
      <form
        className="editor-form prop-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const next = { id: prop?.id ?? crypto.randomUUID(), name, notes };
            commit({ type: prop ? "prop/update" : "prop/create", prop: next });
            setError("");
            setNotice(
              "Prop saved. Save to cloud or export JSON to keep your changes.",
            );
            if (!prop) onCreated(next.id);
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <ErrorNotice error={error} />
        <Field label="Prop name">
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Red bag"
          />
        </Field>
        <Field label="Notes">
          <textarea
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Description or preparation notes"
          />
        </Field>
        <div className="props-actions">
          <Button variant="default" type="submit">
            {prop ? "Save prop" : "Create prop"}
          </Button>
          {prop && (
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              <Trash2 size={16} />
              Delete prop
            </Button>
          )}
        </div>
        {notice && (
          <p role="status" className="field-hint">
            {notice}
          </p>
        )}
      </form>
      {deleting && prop && (
        <div className="error-notice" role="alert">
          <p>
            Delete {prop.name}? It will be untagged from {linked.length} shots.
            The shots and their schedule will stay.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              try {
                commit({ type: "prop/delete", propId: prop.id });
                onDeleted();
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            Confirm delete
          </Button>{" "}
          <Button onClick={() => setDeleting(false)}>Keep prop</Button>
        </div>
      )}
      {prop && (
        <>
          <section className="prop-section" aria-labelledby="prop-usage">
            <h2 id="prop-usage">
              Used in {linked.length} {linked.length === 1 ? "shot" : "shots"}
            </h2>
            {!linked.length && (
              <p className="muted">No shots tagged yet. Choose shots below.</p>
            )}
            {[...groups].map(([scene, shots]) => (
              <div key={scene} className="prop-scene">
                <h3>{scene}</h3>
                {shots.map((shot) => (
                  <button
                    key={shot.id}
                    className="prop-row"
                    onClick={() => onEditShot(shot)}
                  >
                    <span>
                      {shot.code} · {shot.title}
                    </span>
                    <span className="muted">Edit shot</span>
                  </button>
                ))}
              </div>
            ))}
          </section>
          <section className="prop-section" aria-labelledby="tag-prop">
            <h2 id="tag-prop">Tag shots</h2>
            <Field label="Find shots">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search shots or scenes"
              />
            </Field>
            <div className="prop-shot-picker">
              {project.shots
                .filter((shot) =>
                  `${shot.code} ${shot.title} ${shot.sceneLabel}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((shot) => (
                  <Checkbox
                    key={shot.id}
                    label={`${shot.code} · ${shot.title} · ${shot.sceneLabel || "No scene label"}`}
                    checked={shot.propIds.includes(prop.id)}
                    onCheckedChange={(checked) => {
                      try {
                        commit({
                          type: "shot/update",
                          shot: {
                            ...shot,
                            propIds: checked
                              ? [...shot.propIds, prop.id]
                              : shot.propIds.filter((id) => id !== prop.id),
                          },
                        });
                        setError("");
                      } catch (err) {
                        setError(errorMessage(err));
                      }
                    }}
                  />
                ))}
              {!project.shots.length && (
                <p className="muted">
                  Create a shot in the planner to tag this prop.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
