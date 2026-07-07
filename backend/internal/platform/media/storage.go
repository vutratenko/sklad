package media

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const maxPhotoBytes = 5 << 20

var allowedContentTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type Storage struct {
	dir string
}

func NewStorage(dir string) (*Storage, error) {
	if dir == "" {
		dir = "./data/media"
	}
	if err := os.MkdirAll(dir, 0o775); err != nil {
		return nil, fmt.Errorf("create media dir: %w", err)
	}
	if err := assertDirWritable(dir); err != nil {
		return nil, err
	}
	return &Storage{dir: dir}, nil
}

func assertDirWritable(dir string) error {
	probe := filepath.Join(dir, ".writable")
	if err := os.WriteFile(probe, []byte("1"), 0o644); err != nil {
		return fmt.Errorf("media dir not writable: %w", err)
	}
	_ = os.Remove(probe)
	return nil
}

func (s *Storage) SaveSKUPhoto(skuID string, contentType string, r io.Reader) (string, error) {
	ext, ok := allowedContentTypes[strings.ToLower(contentType)]
	if !ok {
		return "", fmt.Errorf("unsupported content type: %s", contentType)
	}

	filename := skuID + ext
	path := filepath.Join(s.dir, filename)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return "", fmt.Errorf("create photo file: %w", err)
	}
	defer f.Close()

	limited := io.LimitReader(r, maxPhotoBytes+1)
	n, err := io.Copy(f, limited)
	if err != nil {
		_ = os.Remove(path)
		return "", fmt.Errorf("write photo: %w", err)
	}
	if n > maxPhotoBytes {
		_ = os.Remove(path)
		return "", fmt.Errorf("photo exceeds max size")
	}

	return "/api/v1/media/" + filename, nil
}

func (s *Storage) Dir() string {
	return s.dir
}
