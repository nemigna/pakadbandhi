import { useState } from "react";
import { CloudUpload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { useCloud } from "../state/project-context";
import { errorMessage } from "../domain/schema";

export function CloudSave() {
  const cloud = useCloud();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  if (!cloud) return null;
  const close = () => {
    if (cloud.busy) return;
    setSecret("");
    setError("");
    setOpen(false);
  };
  return (
    <>
      <Button
        aria-label="Save to cloud"
        disabled={!cloud.ready || cloud.busy}
        onClick={() => setOpen(true)}
      >
        <CloudUpload size={15} />
        <span>Save to cloud</span>
      </Button>
      {open && (
        <Dialog
          title="Save to cloud"
          description="Enter your save key to update the shared project. Everyone with the link can view the saved version."
          onClose={close}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (cloud.busy) return;
              setError("");
              const key = secret;
              setSecret("");
              try {
                await cloud.save(key);
                setOpen(false);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            <label className="field">
              Save key
              <input
                type="password"
                autoComplete="off"
                value={secret}
                required
                maxLength={256}
                disabled={cloud.busy}
                onChange={(event) => setSecret(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <div className="dialog-footer">
              <Button type="button" disabled={cloud.busy} onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={cloud.busy || !secret}
              >
                {cloud.busy ? "Saving…" : "Save project"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
