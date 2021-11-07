namespace WatchIt.Application.Commands.CreateMovie;

using System.Threading;
using System.Threading.Tasks;
using AutoMapper;
using MediatR;
using WatchIt.Domain.Models;

public class CreateMovieRequest : IRequest<CreateMovieResponse>
{
    public string Name { get; set; }
    public string Description { get; set; }

    public class CreateMovieHandler : IRequestHandler<CreateMovieRequest, CreateMovieResponse>
    {
        private readonly IMapper mapper;

        public CreateMovieHandler(IMapper mapper)
        {
            this.mapper = mapper;
        }

        public async Task<CreateMovieResponse> Handle(CreateMovieRequest request, CancellationToken cancellationToken)
        {
            var movie = new Movie()
            {
                Id = 10
            };

            var result = mapper.Map<CreateMovieResponse>(movie);
            return await Task.FromResult(result);
        }
    }
}

