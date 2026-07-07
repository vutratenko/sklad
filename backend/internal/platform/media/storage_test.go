package media_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/vutratenko/sklad/internal/platform/media"
)

func TestNewStorageRequiresWritableDir(t *testing.T) {
	root := t.TempDir()
	readonly := filepath.Join(root, "readonly")
	if err := os.Mkdir(readonly, 0o555); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	_, err := media.NewStorage(readonly)
	if err == nil || !strings.Contains(err.Error(), "not writable") {
		t.Fatalf("expected writable dir error, got %v", err)
	}
}

func TestSaveSKUPhoto(t *testing.T) {
	dir := t.TempDir()
	storage, err := media.NewStorage(dir)
	if err != nil {
		t.Fatalf("NewStorage: %v", err)
	}

	url, err := storage.SaveSKUPhoto("sku-1", "image/jpeg", strings.NewReader("jpeg-bytes"))
	if err != nil {
		t.Fatalf("SaveSKUPhoto: %v", err)
	}
	if url != "/api/v1/media/sku-1.jpg" {
		t.Fatalf("unexpected url: %s", url)
	}

	data, err := os.ReadFile(filepath.Join(dir, "sku-1.jpg"))
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if string(data) != "jpeg-bytes" {
		t.Fatalf("unexpected file contents: %q", string(data))
	}
}
