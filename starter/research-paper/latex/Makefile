.PHONY: all clean watch

all: main.pdf

main.pdf: main.tex references.bib
	pdflatex main.tex
	bibtex main
	pdflatex main.tex
	pdflatex main.tex

clean:
	rm -f *.aux *.bbl *.blg *.log *.out *.pdf

watch:
	@while true; do inotifywait -e modify *.tex *.bib; make; done
